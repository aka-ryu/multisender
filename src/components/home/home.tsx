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
  const [transferResult, setTransferResult] = useState<string | undefined>(
    undefined
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [targetKlaytnScope, setTargetKlaytnScope] = useState<
    string | undefined
  >(undefined);

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

  const estimateGasWeb3 = async (transaction: any, _caver: Caver) => {
    const web3 = new Web3(window.klaytn);
    const estimatedGas = await web3.eth.estimateGas(transaction);
    return Number(estimatedGas);
  };

  const estimateGasKlay = async (transaction: any, _caver: Caver) => {
    const estimatedGas = await _caver.klay.estimateGas(transaction);
    return Number(estimatedGas);
  };

  const feeReset = () => {
    setGasPrice("0");
    setApproveGasUsed(0);
    setMultisendGasUsed(0);
    setTotalFee("0");
  };

  const calculateFeeWeb3 = async () => {
    if (!account || !targetTokenAddress || !klaytn || recipients.length === 0) {
      alert("Kaikas 지갑연결, 토큰계약주소, csv데이터에 문제가 있습니다.");
      return;
    }
    feeReset();

    try {
      const web3 = new Web3(window.klaytn);

      const tokenContract = new web3.eth.Contract(
        testTokenABI as any,
        targetTokenAddress!
      );
      // const multisenderAddress = process.env.REACT_APP_MULTISENDER_CONTRACT;
      const multisenderAddress =
        klaytn.networkVersion == "1001"
          ? "0x443af9ec99f513a7af11804011f50409dc279acb"
          : "0x74EaFC3fD55f8DFF6dB22bCd1Bf59428b2161E90";

      console.log(multisenderAddress);

      const multisenderContract = new web3.eth.Contract(
        multiSenderABI as any,
        multisenderAddress
      );

      const decimalsStr = await tokenContract.methods.decimals().call();
      const decimals = Number(decimalsStr);

      console.log(recipients.length);

      const recipientAddresses = recipients.map((row) => row[0]);
      const amounts = recipients.map((row) => {
        const amount = BigInt(row[1]); // 문자열을 BigInt로 변환
        const power = BigInt(10) ** BigInt(decimals); // 10의 decimals 제곱 계산
        return amount * power;
      });

      const totalAmount = amounts.reduce((acc, cur) => acc + cur, BigInt(0));

      const price = (await web3.eth.getGasPrice()).toString();
      setGasPrice(price);

      const approveTransaction = {
        from: account,
        to: targetTokenAddress,
        data: tokenContract.methods
          .approve(multisenderAddress, totalAmount.toString())
          .encodeABI(),
        gas: price,
      };

      const multisendTransaction = {
        from: account,
        to: multisenderAddress,
        data: multisenderContract.methods
          .multisendToken(targetTokenAddress, recipientAddresses, amounts)
          .encodeABI(),
        gas: price,
      };

      if (approveTransaction && multisendTransaction) {
        const approveGas = await estimateGasWeb3(approveTransaction, caver);

        setApproveGasUsed(approveGas);

        const multisendGas = await estimateGasWeb3(multisendTransaction, caver);
        setMultisendGasUsed(multisendGas);

        const totalGas = approveGas + multisendGas;
        const estimatedFeeInPeb = BigInt(totalGas) * BigInt(price);
        const estimatedFeeInKlay = caver.utils.fromPeb(
          estimatedFeeInPeb.toString(),
          "KLAY"
        );
        setTotalFee(estimatedFeeInKlay);
      }
    } catch (error) {
      alert("예상수수료 측정중 오류발생");
    }
  };

  const calculateFeeKlay = async () => {
    if (!account || !targetTokenAddress || !klaytn || recipients.length === 0) {
      alert("Kaikas 지갑연결, 토큰계약주소, csv데이터에 문제가 있습니다.");
      return;
    }

    feeReset();

    const _caver = new Caver(window.klaytn);

    try {
      const tokenContract = new _caver.contract(
        testTokenABI as any,
        targetTokenAddress!
      );
      // const multisenderAddress = process.env.REACT_APP_MULTISENDER_CONTRACT;
      const multisenderAddress =
        klaytn.networkVersion == "1001"
          ? "0x443af9ec99f513a7af11804011f50409dc279acb"
          : "0x74EaFC3fD55f8DFF6dB22bCd1Bf59428b2161E90";

      console.log(multisenderAddress);
      const multisenderContract = new _caver.contract(
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

      const price = await _caver.klay.getGasPrice();
      setGasPrice(price);

      const approveTransaction = {
        from: account,
        to: targetTokenAddress,
        data: tokenContract.methods
          .approve(multisenderAddress, totalAmount.toString())
          .encodeABI(),
        gas: price,
      };

      const multisendTransaction = {
        from: account,
        to: multisenderAddress,
        data: multisenderContract.methods
          .multisendToken(targetTokenAddress, recipientAddresses, amounts)
          .encodeABI(),
        gas: price,
      };

      if (approveTransaction && multisendTransaction) {
        const approveGas = await estimateGasKlay(approveTransaction, caver);

        setApproveGasUsed(approveGas);

        const multisendGas = await estimateGasKlay(multisendTransaction, caver);
        setMultisendGasUsed(multisendGas);

        const totalGas = approveGas + multisendGas;
        const estimatedFeeInPeb = BigInt(totalGas) * BigInt(price);
        const estimatedFeeInKlay = caver.utils.fromPeb(
          estimatedFeeInPeb.toString(),
          "KLAY"
        );
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
      setFileName(file!.name);
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
      if (caver.utils.isAddress(row[0]) && !isNaN(Number(row[1]))) {
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
    console.log("실행한다ㅏ");

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
          console.log("dd?");
          const _balance = Web3.utils.fromWei(result.result, "ether");
          if (Number(_balance) > 0) {
            console.log("돈있어");
            setBalance(_balance);
          } else {
            console.log("돈없어");
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

    if (!caver.utils.isAddress(targetTokenAddress)) {
      alert("토큰 계약주소가 올바르지 않습니다.");
      return;
    }
    const web3 = new Web3(window.klaytn);

    const tokenContractABI = testTokenABI;

    const tokenContract = new web3.eth.Contract(
      tokenContractABI as any,
      targetTokenAddress
    );

    const multisenderABI = multiSenderABI;

    const multisenderAddress =
      klaytn.networkVersion == "1001"
        ? "0x443af9ec99f513a7af11804011f50409dc279acb"
        : "0x74EaFC3fD55f8DFF6dB22bCd1Bf59428b2161E90";

    console.log(multisenderAddress);
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
      setTxHash(result.transactionHash);
      const targetScope =
        klaytn.networkVersion == "8217"
          ? `https://klaytnscope.com/tx/${result.transactionHash}`
          : `https://baobab.klaytnscope.com/tx/${result.transactionHash}`;
      setTransferResult("성공");
      setTargetKlaytnScope(targetScope);
      alert("Transaction successful");
    } catch (error) {
      console.error("Transaction failed:", error);
      setTransferResult("실패");
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
              멀티샌더 컨트랙트 {chainId == "1001" ? "Baobab" : "Cypress"}{" "}
              {chainId == "1001"
                ? "0x443af9ec99f513a7af11804011f50409dc279acb"
                : "0x74EaFC3fD55f8DFF6dB22bCd1Bf59428b2161E90"}
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
                  <button onClick={calculateFeeWeb3}>
                    예상 수수료 계산 web3
                  </button>

                  <button onClick={calculateFeeKlay}>
                    예상 수수료 계산 klay
                  </button>

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
                        서버상태에 따라 측정이 어려울수 있습니다.
                        <br />
                        <br />
                        예상수수료계산에 web3, klay 버튼은 각 예상수수료 계산
                        로직을 각 로직을 <br />
                        klay라이브러리, web3라이브러리로 계산한 것입니다.
                        <br />
                        <br />
                        실제 예상수수료의 정확도는 보장되지 않으며 실제
                        kaikas에서 승인시 확인이 필요합니다.
                        <br />
                        <br />
                        전송시 kaikas 앱에서 두번의 승인과 수수료확인을 하게
                        됩니다.
                        <br />
                        1단계 : approve 승인
                        <br />
                        2단계 : multisender 승인
                        <br />
                        이중 1단계의 수수료는 매우 적은편이며 중요하게
                        봐야할것은 2단계의 수수료입니다.
                        <br />
                        <br />
                        개발단계에서 멀티샌더 전송대상 수에 따른 2단계 수수료를
                        측정하였고 내용은 이와 같습니다.
                        <br />
                        <br />
                        100명 0.133185KLAY (1명기준 0.00133185)
                        <br />
                        300명 0.351407KLAY (1명기준 0.00117135)
                        <br />
                        600명 0.679004KLAY (1명기준 0.00113167)
                        <br />
                        1000명 1.117386KLAY (1명 기준 0.00111738)
                        <br />
                        <br />
                        대상이 많을수록 인당 수수료는 소폭 감소하지만 무의미한
                        수준이며 거진 정비례하여 증가함을 확인하였습니다.
                      </p>
                    </>
                  )}
                </div>
                {transferResult ? (
                  <>
                    <p className="result">{transferResult}</p>
                    {txHash && (
                      <a
                        href={targetKlaytnScope}
                        target="_blank"
                        className="tx-hash"
                      >
                        {txHash}
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <button className="send-button" onClick={handleSendTokens}>
                      전송하기
                    </button>
                  </>
                )}
              </div>
            )}

            <div>
              <h3>{fileName && `파일명 : ${fileName}`}</h3>
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
                        잘못된 대상 : {invaildData.length}명 (지갑주소 혹은
                        수량)
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
