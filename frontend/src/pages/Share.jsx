import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Share() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [fileName, setFileName] = useState("");

  useEffect(() => {
    loadSharedFile();
  }, []);

  const loadSharedFile = async () => {
    try {
      const response = await api.get(`/files/share/${token}`);

      setFileName(response.data.fileName);
    } catch (err) {
      console.error(err);

      navigate("/dashboard");
    }
  };

  const handlePreview = async () => {
    try {
      const response = await api.get(`/files/share/${token}?consume=true`);

      window.open(response.data.previewUrl, "_blank");
    } catch (err) {
      console.error(err);

      alert(err.response?.data?.error || "Preview failed");
    }
  };

  const handleDownload = async () => {
    try {
      const response = await api.get(`/files/share/${token}?consume=true`);

      window.location.href = response.data.previewUrl;
    } catch (err) {
      console.error(err);

      alert(err.response?.data?.error || "Download failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 w-125 text-center">
        <h1 className="text-3xl font-bold mb-6">Shared File</h1>

        <p className="mb-6">{fileName}</p>

        {fileName && (
          <div className="flex justify-center gap-4">
            <button
              onClick={handlePreview}
              className="bg-green-600 hover:bg-green-700 px-5 py-2 rounded-lg"
            >
              Preview
            </button>

            <button
              onClick={handleDownload}
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
