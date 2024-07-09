import React, { ReactElement, useEffect, useState } from "react";
import "./home.css";
import KaikasLogo from "../../assets/images/kaikas-logo.png";
import Web3 from "web3";
import CSVUpload from "../CSVUpload/csvUpload";
import multiSenderABI from "../../config/multisenderABI.json";
import testTokenABI from "../../config/testTokenABI.json";

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
  const [totalTarnsferAmount, setTotalTransferAmount] = useState<number>(0);

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
    const _totalTransferAmount = data.reduce(
      (acc, cur) => acc + Number(cur[1]),
      0
    );
    setTotalTransferAmount(_totalTransferAmount);
  };

  const handleSendTokens = async () => {
    if (!account || !targetTokenAddress || !klaytn || recipients.length === 0) {
      alert("Kaikas wallet, token address, or CSV data is missing.");
      return;
    }
    const web3 = new Web3(klaytn);

    const tokenContractABI = testTokenABI;

    const tokenContract = new web3.eth.Contract(
      tokenContractABI as any,
      targetTokenAddress
    );

    const multisenderABI = multiSenderABI;

    const multisenderAddress = "0x443af9ec99f513a7af11804011f50409dc279acb"; // 배포한 멀티샌더 컨트랙트 주소로 변경

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
            <label htmlFor="inputField">전송할 토큰의 계약주소</label>
            <input
              className="token-address-input"
              type="text"
              placeholder="전송할 토큰의 계약주소"
              onChange={(e) => setTargetTokenAddress(e.target.value)}
            />

            <CSVUpload onUpload={handleCSVUpload} />
            {recipients.length > 0 && (
              <>
                <h4>전송 대상 {recipients.length}명</h4>
                <h4>전송 수량 {totalTarnsferAmount}개</h4>
                <button className="send-button" onClick={handleSendTokens}>
                  Send Tokens
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
