import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";

function Dashboard() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [shareFileId, setShareFileId] = useState(null);
  const [shareExpiry, setShareExpiry] = useState("");
  const [shareOneTime, setShareOneTime] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);

  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShareFileId(null);

        setOpenMenu(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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

      fileInputRef.current.value = "";

      loadFiles();
    } catch (err) {
      console.error(err);

      alert("Upload failed");
    }
  };

  const handlePreview = async (fileId) => {
    try {
      const token = localStorage.getItem("token");

      const response = await api.get(`/files/view/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      window.open(response.data.previewUrl, "_blank");
    } catch (err) {
      console.error(err);

      alert("Preview failed");
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

  const handleDelete = async (fileId) => {
    try {
      const confirmed = window.confirm("Delete this file?");

      if (!confirmed) return;

      const token = localStorage.getItem("token");

      await api.delete(`/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      loadFiles();
    } catch (err) {
      console.error(err);

      alert("Delete failed");
    }
  };

  const handleShare = async (fileId) => {
    try {
      const token = localStorage.getItem("token");

      const response = await api.post(
        `/files/${fileId}/share`,
        {
          expiryHours: shareExpiry === "" ? null : Number(shareExpiry),

          isOneTime: shareOneTime,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      await navigator.clipboard.writeText(response.data.shareUrl);

      alert("Share link copied!");

      setShareFileId(null);
      setShareExpiry("");
      setShareOneTime(false);
    } catch (err) {
      console.error(err);

      alert("Share failed");
    }
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
              ref={fileInputRef}
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
                    <h3
                      onClick={() => {
                        handlePreview(file.id);
                      }}
                      className="font-medium text-lg text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      {file.file_name}
                    </h3>

                    <p className="text-gray-400 text-sm mt-1">
                      Click filename to preview
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShareFileId(file.id);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 px-5 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Share
                    </button>

                    <div ref={menuRef} className="relative">
                      <button
                        onClick={() => {
                          setOpenMenu(openMenu === file.id ? null : file.id);
                        }}
                        className="bg-[#21262d] hover:bg-[#30363d] px-4 py-2 rounded-lg"
                      >
                        ⋮
                      </button>

                      {openMenu === file.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-[#161b22] border border-[#30363d] rounded-xl shadow-lg z-50">
                          <button
                            onClick={() => {
                              handleDownload(file.id);
                              setOpenMenu(null);
                            }}
                            className="block w-full text-left px-4 py-3 hover:bg-[#21262d]"
                          >
                            Download
                          </button>

                          <button
                            onClick={() => {
                              handleDelete(file.id);
                              setOpenMenu(null);
                            }}
                            className="block w-full text-left px-4 py-3 hover:bg-[#21262d]"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      {shareFileId && (
        <div
          onClick={() => {
            setShareFileId(null);
          }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-112.5"
          >
            <h2 className="text-xl font-bold mb-5">Create Share Link</h2>

            <select
              value={shareExpiry}
              onChange={(e) => setShareExpiry(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 mb-4"
            >
              <option value="">Never Expire</option>

              <option value="1">1 Hour</option>

              <option value="24">24 Hours</option>

              <option value="168">7 Days</option>
            </select>

            <label className="flex items-center gap-3 mb-6">
              <input
                type="checkbox"
                checked={shareOneTime}
                onChange={(e) => setShareOneTime(e.target.checked)}
              />
              One-Time Link
            </label>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShareFileId(null);
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => handleShare(shareFileId)}
                className="bg-purple-600 px-5 py-2 rounded-lg"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
