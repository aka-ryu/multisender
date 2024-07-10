import React, { ReactElement, useEffect, useState, useCallback } from "react";
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
  const [chainId, setChainId] = useState<string | null>(null);
  const [chainName, setChainName] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [targetTokenAddress, setTargetTokenAddress] = useState<string | null>(
    null
  );
  const [recipients, setRecipients] = useState<string[][]>([]);

  const klaytn = window.klaytn ? window.klaytn : null;
  const caver = new Caver(klaytn);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [invaildData, setInvaildData] = useState<string[][]>([]);
  const [vaildTargetCount, setVaildTargetCount] = useState<number>(0);
  const [totalTransferAmount, setTotalTransferAmount] = useState<number>(0);

  useEffect(() => {
    checkKaikasConnection();
  }, []);

  useEffect(() => {
    updateChainName(chainId);
    checkKaikasConnection();
  }, [chainId]);

  useEffect(() => {
    if (klaytn) {
      klaytn.on("networkChanged", (newNetworkVersion: string) => {
        setChainId(newNetworkVersion);
      });

      klaytn.on("accountsChanged", (newAccounts: string[]) => {
        setAccount(newAccounts[0]);
        getKlaytnBalance(newAccounts[0]);
      });

      klaytn.autoRefreshOnNetworkChange = true;
    }
  }, [klaytn]);

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

  const updateChainName = (id: string | null) => {
    if (id == "1001") {
      setChainName("Baobab");
    } else if (id == "8217") {
      setChainName("Cypress");
    } else {
      setChainName("Unknown Network");
    }
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

  const checkKaikasConnection = async () => {
    if (!klaytn) return;

    const isUnlocked = await klaytn._kaikas.isUnlocked();
    if (isUnlocked) {
      handleConnectKaikas();
    }
  };

  const handleConnectKaikas = async () => {
    if (!klaytn) return;

    try {
      const accounts = await klaytn.enable();
      setAccount(accounts[0]);
      setChainId(klaytn.networkVersion);
      getKlaytnBalance(accounts[0]);
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
      {!account ? (
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
            <div className="chain-name">{chainName}</div>
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
              <>
                <button className="send-button" onClick={handleSendTokens}>
                  전송하기
                </button>
              </>
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
