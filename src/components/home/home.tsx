import React, {
  ReactElement,
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import "./home.css";
import KaikasLogo from "../../assets/images/kaikas-logo.png";
import Web3 from "web3";
import multiSenderABI from "../../config/multisenderABI.json";
import testTokenABI from "../../config/testTokenABI.json";
import Caver from "caver-js";

declare global {
  interface Window {
    klaytn: any;
  }
}

const Home = (): ReactElement => {
  const [account, setAccount] = useState<string | null>(null);
  const [isKaikasLogin, setIsKaikasLogin] = useState<boolean>(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [targetTokenAddress, setTargetTokenAddress] = useState<string | null>(
    null
  );
  const [recipients, setRecipients] = useState<string[][]>([]);

  const klaytn = window.klaytn ? window.klaytn : null;
  const caver = new Caver(klaytn);
  const [caverInstance, setCaverInstance] = useState<Caver | null>(null);

  const [csvData, setCsvData] = useState<string[][]>([]);
  const [invaildData, setInvaildData] = useState<string[][]>([]);
  const [vaildTargetCount, setVaildTargetCount] = useState<number>(0);
  const [totalTransferAmount, setTotalTransferAmount] = useState<number>(0);
  const [gasPrice, setGasPrice] = useState<string>("0");
  const [approveGasUsed, setApproveGasUsed] = useState<number>(0);
  const [multisendGasUsed, setMultisendGasUsed] = useState<number>(0);
  const [totalFee, setTotalFee] = useState<string>("0");
  const [feeLoading, setFeeLoading] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      // const _kaikasEnabled = await klaytn._kaikas.isEnabled();
      if (typeof window.klaytn !== "undefined") {
        const _kaikasApproved = await klaytn._kaikas.isApproved();
        const _kaikasUnlocked = await klaytn._kaikas.isUnlocked();
        setIsKaikasLogin(_kaikasApproved && _kaikasUnlocked);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (isKaikasLogin) {
      if (klaytn.selectedAddress !== null) {
        setIsKaikasLogin(true);
        setChainId(klaytn.networkVersion);
        setAccount(klaytn.selectedAddress);
        getKlaytnBalance(klaytn.selectedAddress);
        setCaverInstance(window.klaytn);
      }
    }
  }, [isKaikasLogin]);

  if (typeof window.klaytn !== "undefined" && isKaikasLogin) {
    // if (typeof window.klaytn !== "undefined") {
    // Kaikas가 설치된 경우에만 이벤트 리스너 등록
    klaytn.on("accountsChanged", function (accounts: any) {
      console.log("계정변경 감지");
      const _selectedAddress = klaytn.selectedAddress;
      setAccount(_selectedAddress);
      getKlaytnBalance(_selectedAddress);
    });
    klaytn.on("networkChanged", function (networkId: any) {
      console.log("서버변경 감지");
      setChainId(klaytn.networkVersion);
      getKlaytnBalance(klaytn.selectedAddress);
      setCaverInstance(window.klaytn);
    });
    klaytn.on("disconnected", function () {
      console.log("kaikas 잠금");
      setIsKaikasLogin(false);
    });
  }

  // useEffect(() => {
  //   if (klaytn._kaikas.isEnabled()) {
  //     checkKaikasConnection();
  //     setChainId(klaytn.networkVersion);
  //     setAccount(klaytn.selectedAddress);
  //   }
  // }, []);

  // useEffect(() => {
  //   updateChainName(chainId);
  //   //checkKaikasConnection();
  //   getKlaytnBalance(account);
  // }, [chainId, account]);

  // useEffect(() => {
  //   if (klaytn) {
  //     klaytn.on("networkChanged", (newNetworkVersion: string) => {
  //       setChainId(newNetworkVersion);
  //     });

  //     klaytn.on("accountsChanged", (newAccounts: string[]) => {
  //       setAccount(newAccounts[0]);
  //       getKlaytnBalance(newAccounts[0]);
  //     });

  //     klaytn.autoRefreshOnNetworkChange = true;
  //   }
  // }, [klaytn]);

  const getGasPrice = async (_caver: Caver) => {
    const price = await _caver.klay.getGasPrice();
    setGasPrice(price);
    return price;
  };

  const estimateGas = async (transaction: any, _caver: Caver) => {
    const web3 = new Web3(klaytn);
    const estimatedGas = await web3.eth.estimateGas(transaction);
    return Number(estimatedGas);
  };

  const calculateFee = async () => {
    if (!account || !targetTokenAddress || !klaytn || recipients.length === 0) {
      alert("Kaikas 지갑연결, 토큰계약주소, csv데이터에 문제가 있습니다.");
      return;
    }

    try {
      const _caver = new Caver(klaytn);

      const web3 = new Web3(klaytn);

      const tokenContract = new web3.eth.Contract(
        testTokenABI as any,
        targetTokenAddress!
      );
      // const multisenderAddress = process.env.REACT_APP_MULTISENDER_CONTRACT;
      const multisenderAddress = "0x13d2F94261C4883612a100821196193A3FaA8D14";
      const multisenderContract = new caver.klay.Contract(
        multiSenderABI as any,
        multisenderAddress
      );

      const decimalsStr = await tokenContract.methods.decimals().call();
      const decimals = Number(decimalsStr);

      const recipientAddresses = recipients.map((row) => row[0]);
      const amounts = recipients.map((row) => {
        const amount = BigInt(row[1]); // 문자열을 BigInt로 변환
        const power = BigInt(10) ** BigInt(decimals); // 10의 decimals 제곱 계산
        return amount * power;
      });

      const totalAmount = amounts.reduce((acc, cur) => acc + cur, BigInt(0));

      const price = await caver.klay.getGasPrice();
      setGasPrice(price);
      // Approve transaction object
      const approveTransaction = {
        from: account,
        to: targetTokenAddress,
        data: tokenContract.methods
          .approve(multisenderAddress, totalAmount.toString())
          .encodeABI(),
        gas: price,
      };

      // Multisend transaction object
      const multisendTransaction = {
        from: account,
        to: multisenderAddress,
        data: multisenderContract.methods
          .multisendToken(targetTokenAddress, recipientAddresses, amounts)
          .encodeABI(),
        gas: price,
      };

      console.log(await _caver.rpc.net.getNetworkId());
      console.log(price, "price");

      console.log(
        approveTransaction,
        multisendTransaction,
        "approveTransaction, multisendTransaction"
      );

      if (approveTransaction && multisendTransaction) {
        const approveGas = await estimateGas(approveTransaction, caver);
        console.log(approveGas, "approveGas");

        setApproveGasUsed(approveGas);

        const multisendGas = await estimateGas(multisendTransaction, caver);
        console.log(multisendGas, "multisendGas");
        setMultisendGasUsed(multisendGas);

        const totalGas = approveGas + multisendGas;
        console.log(totalGas, "totalGas");
        const estimatedFeeInPeb = BigInt(totalGas) * BigInt(price);
        console.log(estimatedFeeInPeb, "estimatedFeeInPeb");
        const estimatedFeeInKlay = caver.utils.fromPeb(
          estimatedFeeInPeb.toString(),
          "KLAY"
        );
        console.log(estimatedFeeInKlay, "estimatedFeeInKlay");
        setTotalFee(estimatedFeeInKlay);
      }
    } catch (error) {
      alert("예상수수료 측정중 오류발생");
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            processData(reader.result);
          }
        };
        reader.readAsText(file);
      }
    },
    []
  );

  const processData = (csv: string) => {
    const rows = csv.split("\n");
    const data = rows.map((row) => {
      const rowValues = row.split(",").map((value) => value.trim());
      return rowValues.filter((value) => value !== "");
    });

    if (data.length > 0 && data[data.length - 1].length === 0) {
      data.shift();
      data.pop();
    }

    let wrongData: string[][] = [];
    let filteredData = data.filter((row) => {
      if (caver.utils.isAddress(row[0])) {
        return row;
      } else {
        wrongData.push(row);
      }
    });

    const _totalTransferAmount = filteredData.reduce(
      (acc, cur) => acc + Number(cur[1]),
      0
    );
    setTotalTransferAmount(_totalTransferAmount);
    setInvaildData(wrongData);

    setCsvData(filteredData);
    handleCSVUpload(filteredData);
  };

  const handleReset = () => {
    // setCsvData([]);
    // setInvaildData([]);
    // setTotalTransferAmount(0);
    // setRecipients([]);
    // const input = document.querySelector(
    //   'input[type="file"]'
    // ) as HTMLInputElement;
    // if (input) {
    //   input.value = "";
    // }

    window.location.reload();
  };

  const getKlaytnBalance = async (_walletAddress: any) => {
    if (!klaytn) return;

    klaytn.sendAsync(
      {
        method: "klay_getBalance",
        params: [_walletAddress, "latest"],
        jsonrpc: "2.0",
        id: 1,
      },
      (err: any, result: { result: any }) => {
        if (err) {
          console.error("Error fetching balance:", err);
        } else {
          const _balance = Web3.utils.fromWei(result.result, "ether");
          if (Number(_balance) > 0) {
            setBalance(_balance);
          } else {
            setBalance("0");
          }
        }
      }
    );
  };

  const handleConnectKaikas = async () => {
    if (!klaytn) {
      alert("kaikas가 없습니다.");
      return;
    }
    if (isKaikasLogin) {
      alert("이미 로그인함 리턴한다");
      return;
    }
    try {
      await klaytn.enable();
      if (klaytn.selectedAddress !== null) {
        setIsKaikasLogin(true);
        setChainId(klaytn.networkVersion);
        setAccount(klaytn.selectedAddress);
        getKlaytnBalance(klaytn.selectedAddress);
      }
    } catch (error) {
      console.error("Error connecting Kaikas:", error);
      alert("Error connecting Kaikas wallet");
    }
  };

  const handleCSVUpload = (data: string[][]) => {
    setRecipients(data);
  };

  const handleSendTokens = async () => {
    if (!account || !targetTokenAddress || !klaytn || recipients.length === 0) {
      alert("Kaikas 지갑연결, 토큰계약주소, csv데이터에 문제가 있습니다.");
      return;
    }
    const web3 = new Web3(klaytn);

    const tokenContractABI = testTokenABI;

    const tokenContract = new web3.eth.Contract(
      tokenContractABI as any,
      targetTokenAddress
    );

    const multisenderABI = multiSenderABI;

    const multisenderAddress = process.env.REACT_APP_MULTISENDER_CONTRACT;

    const multisenderContract = new web3.eth.Contract(
      multisenderABI as any,
      multisenderAddress
    );

    const decimalsStr = await tokenContract.methods.decimals().call();
    const decimals = Number(decimalsStr);

    try {
      const recipientAddresses = recipients.map((row) => row[0]);
      const amounts = recipients.map((row) => {
        const amount = BigInt(row[1]); // 문자열을 BigInt로 변환
        const power = BigInt(10) ** BigInt(decimals); // 10의 decimals 제곱 계산
        return amount * power;
      });

      const totalAmount = amounts.reduce((acc, cur) => acc + cur, BigInt(0));

      await tokenContract.methods
        .approve(multisenderAddress, totalAmount.toString())
        .send({ from: account });

      const result = await multisenderContract.methods
        .multisendToken(targetTokenAddress, recipientAddresses, amounts)
        .send({ from: account });
      console.log("Transaction successful:", result);
      alert("Transaction successful");
    } catch (error) {
      console.error("Transaction failed:", error);
      alert("Transaction failed");
    }
  };

  return (
    <div>
      {!isKaikasLogin ? (
        <div className="non-login-container">
          <h1>Kaikas Wallet Connection</h1>
          <div className="wallet-connect-button" onClick={handleConnectKaikas}>
            <img className="kaikas-logo" src={KaikasLogo} alt="" />
            <p>Connect to Kaikas</p>
          </div>
        </div>
      ) : (
        <div className="login-container">
          <div className="wallet-info-layer">
            <div className="chain-name">
              {chainId == "1001"
                ? "Baobab Testnet"
                : chainId == "8217"
                ? "Cypress Mainnet"
                : "Unknown Chain"}
            </div>
            <div className="wallet-address">{account}</div>
            <div className="main-token-balance">{balance} KLAY</div>
          </div>
          <div className="transfer-layer">
            <h4>
              멀티샌더 컨트랙트 {process.env.REACT_APP_TARGET_MULTISENDER_CHAIN}{" "}
              {process.env.REACT_APP_MULTISENDER_CONTRACT}
            </h4>
            <label htmlFor="inputField">토큰의 계약주소 입력</label>
            <input
              className="token-address-input"
              type="text"
              placeholder="전송할 토큰의 계약주소"
              onChange={(e) => setTargetTokenAddress(e.target.value)}
            />
            {csvData.length > 0 && (
              <div className="send-layer">
                <div>
                  <button onClick={calculateFee}>예상 수수료 계산 web3</button>

                  {feeLoading ? (
                    <>
                      <div className="spinner"></div>
                    </>
                  ) : (
                    <>
                      <p>가스 가격: {gasPrice}</p>
                      <p>Approve 가스 사용량: {approveGasUsed}</p>
                      <p>Multisend 가스 사용량: {multisendGasUsed}</p>
                      <p>총 예상 수수료: {totalFee} KLAY</p>
                      <p className="fee-warning">
                        실제 수수료는 다를수 있습니다 kaikas에서 승인전 확인해
                        주세요
                      </p>
                    </>
                  )}
                </div>
                <button className="send-button" onClick={handleSendTokens}>
                  전송하기 웹3
                </button>
              </div>
            )}

            <div>
              <h3>CSV Upload</h3>
              {csvData.length > 0 ? (
                <>
                  <button onClick={handleReset}>초기화(새로고침)</button>
                </>
              ) : (
                <>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                  />
                </>
              )}
              <div>
                <>
                  {invaildData.length > 0 && (
                    <>
                      <h4 className="invaild-target">
                        잘못된 대상 : {invaildData.length}명
                      </h4>
                      <ul>
                        {invaildData.map((row, index) => (
                          <li key={index}>{JSON.stringify(row)}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>

                <>
                  {csvData.length > 0 && (
                    <>
                      <h4 className="vaild-target">
                        유효한 대상 : {csvData.length}명 {totalTransferAmount}개
                      </h4>
                      <ul>
                        {csvData.map((row, index) => (
                          <li key={index}>{JSON.stringify(row)}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
