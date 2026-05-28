import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";

function Dashboard() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);

  const loadFiles = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await api.get("/files/sync/2000-01-01", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setFiles(response.data.updatedFiles);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");

        navigate("/login");
      }

      console.error(err);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleUpload = async () => {
    try {
      if (!selectedFile) {
        return alert("Select a file first");
      }

      const formData = new FormData();

      formData.append("file", selectedFile);

      const token = localStorage.getItem("token");

      await api.post("/files/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSelectedFile(null);

      loadFiles();
    } catch (err) {
      console.error(err);

      alert("Upload failed");
    }
  };

  const handleDownload = async (fileId) => {
    try {
      const token = localStorage.getItem("token");

      const response = await api.get(`/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
      });

      const contentDisposition = response.headers["content-disposition"];

      let fileName = "downloaded-file";

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match?.[1]) {
          fileName = match[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", fileName);

      document.body.appendChild(link);

      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert("Download failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");

    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <nav className="border-b border-[#30363d] bg-[#161b22]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SyncVault</h1>

            <p className="text-gray-400 text-sm">Distributed File Storage</p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-5">Upload File</h2>

          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="file"
              onChange={(e) => {
                setSelectedFile(e.target.files[0]);
              }}
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-gray-300 file:mr-4 file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-[#21262d] file:text-white"
            />

            <button
              onClick={handleUpload}
              className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-semibold transition"
            >
              Upload
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Your Files</h2>

            <p className="text-gray-400 text-sm">{files.length} files</p>
          </div>

          {files.length === 0 ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-10 text-center text-gray-400">
              No files uploaded yet
            </div>
          ) : (
            <div className="grid gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-lg">{file.file_name}</h3>

                    <p className="text-gray-400 text-sm mt-1">
                      Version {file.version}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      handleDownload(file.id);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
