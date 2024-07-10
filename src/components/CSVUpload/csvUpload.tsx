import React, { useCallback, useState } from "react";
import Caver from "caver-js";
import "./csvUpload.css";

interface CSVUploadProps {
  onUpload: (data: string[][]) => void; // CSV 데이터를 전달할 콜백 함수
}

const CSVUpload: React.FC<CSVUploadProps> = ({ onUpload }) => {
  const klaytn = window.klaytn ? window.klaytn : null;
  const caver = new Caver(klaytn);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [invaildData, setInvaildData] = useState<string[][]>([]);
  const [vaildTargetCount, setVaildTargetCount] = useState<number>(0);
  const [totalTransferAmount, setTotalTransferAmount] = useState<number>(0);

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

    console.log(filteredData);
    console.log(wrongData);

    setCsvData(filteredData);
    onUpload(filteredData);
  };

  const handleReset = () => {
    setCsvData([]);
    setInvaildData([]);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    if (input) {
      input.value = "";
    }
  };

  return (
    <div>
      <h3>CSV Upload</h3>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <button onClick={handleReset}>초기화</button>
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
  );
};

export default CSVUpload;
