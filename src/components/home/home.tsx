/* eslint-disable eqeqeq */
// App.tsx

import React, { useEffect, useState } from "react";
import "./home.css";
import KaikasLogo from "../../assets/images/kaikas-logo.png";
import Caver from "caver-js";

declare global {
  interface Window {
    klaytn: any;
  }
}

const Home: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [chainName, setChainName] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const caver = new Caver(window.klaytn);

  // 초기 렌더링시 실행
  useEffect(() => {
    connectCheck();
  }, []);

  const connectCheck = async () => {
    const _isConnect = await window.klaytn._kaikas.isUnlocked();
    if (_isConnect) {
      handleConnectKaikas();
    }
  };

  // chainId 탐지
  useEffect(() => {
    if (chainId == "1001") {
      setChainName("Baobab Testnet");
    } else if (chainId == "8217") {
      setChainName("Cypress Mainnet");
    } else {
      setChainName("Unknown Network");
    }
  }, [chainId]);

  const handleConnectKaikas = async () => {
    if (window.klaytn) {
      await window.klaytn
        .enable()
        .then(async (accounts: string[]) => {
          setAccount(accounts[0]);
          setChainId(window.klaytn.networkVersion);
        })
        .catch((error: any) => {
          alert("지갑 연결중 에러가 발생하였습니다.");
        });
      await window.klaytn.on("accountsChanged", (accounts: string[]) => {
        setAccount(accounts[0] || null); // 계정이 없으면 null로 설정
      });
    } else {
      alert("카이카스 지갑을 설치 해주세요.");
    }
  };

  return (
    <div className="container">
      {!account ? (
        <>
          <h1>Kaikas Wallet Connection</h1>
          <div className="wallet-connect-button" onClick={handleConnectKaikas}>
            <img className="kaikas-logo" src={KaikasLogo} alt="" />
            <p>Connect to Kaikas</p>
          </div>
        </>
      ) : (
        <>
          <div className="wallet-info-layer">
            <div className="chain-name">{chainName}</div>
            <div className="wallet-address">{account}</div>
            <div className="main-token-balance">{balance}</div>
          </div>
          <p>지갑연결됨 {window.klaytn.networkVersion}</p>
        </>
      )}
    </div>
  );
};

export default Home;
