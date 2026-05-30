import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Share() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    loadSharedFile();
  }, []);

  const loadSharedFile = async () => {
    try {
      const response = await api.get(`/files/share/${token}`);

      setFileName(response.data.fileName);

      setPreviewUrl(response.data.previewUrl);
    } catch (err) {
      console.error(err);

      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 w-125 text-center">
        <h1 className="text-3xl font-bold mb-6">Shared File</h1>

        <p className="mb-6">{fileName}</p>

        {previewUrl && (
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                window.open(previewUrl, "_blank");
              }}
              className="bg-green-600 hover:bg-green-700 px-5 py-2 rounded-lg"
            >
              Preview
            </button>

            <button
              onClick={() => {
                window.location.href = previewUrl;
              }}
              className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg"
            >
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Share;
