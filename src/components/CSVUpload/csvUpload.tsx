import React, { useCallback, useState } from "react";

interface CSVUploadProps {
  onUpload: (data: string[][]) => void; // CSV 데이터를 전달할 콜백 함수
}

const CSVUpload: React.FC<CSVUploadProps> = ({ onUpload }) => {
  const [csvData, setCsvData] = useState<string[][]>([]);

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
      data.pop();
    }

    setCsvData(data);
    onUpload(data);
  };

  return (
    <div>
      <h2>CSV Upload</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <div>
        <h3>Uploaded CSV Data:</h3>
        <ul>
          {csvData.map((row, index) => (
            <li key={index}>{JSON.stringify(row)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CSVUpload;
