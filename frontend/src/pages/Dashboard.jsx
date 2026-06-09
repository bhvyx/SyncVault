import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import api from "../services/api";

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [shareFileId, setShareFileId] = useState(null);
  const [shareExpiry, setShareExpiry] = useState("");
  const [shareOneTime, setShareOneTime] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [manageFileId, setManageFileId] = useState(null);
  const [shareLinks, setShareLinks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

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

        navigate("/login", {
          state: {
            message: "Session expired, please login again",
            type: "error",
          },
        });
      } else {
        console.error(err);

        showMessage("error", "Failed to load files");
      }
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

  const showMessage = (type, text) => {
    setMessage({ type, text });

    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  useEffect(() => {
    if (location.state?.message) {
      showMessage(location.state.type || "error", location.state.message);

      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleUpload = async () => {
    try {
      if (!selectedFile) {
        showMessage("error", "Please select a file to upload");

        return;
      }

      setUploading(true);

      const formData = new FormData();

      formData.append("file", selectedFile);

      const token = localStorage.getItem("token");

      await api.post("/files/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSelectedFile(null);
      showMessage("success", "Upload successful");

      fileInputRef.current.value = "";

      loadFiles();
    } catch (err) {
      console.error(err);

      showMessage("error", err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
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

      showMessage("error", err.response?.data?.error || "Preview Failed");
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
      showMessage("error", "Download failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    showMessage("success", "Logged out");
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

      showMessage("success", "File deleted");

      loadFiles();
    } catch (err) {
      console.error(err);

      showMessage("error", "Delete failed");
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

      showMessage("success", "Share link copied!");

      setShareFileId(null);
      setShareExpiry("");
      setShareOneTime(false);
    } catch (err) {
      showMessage("error", err.response?.data?.error || "Share failed");
    }
  };

  const handleManageLinks = async (fileId) => {
    try {
      const token = localStorage.getItem("token");

      const response = await api.get(`/files/${fileId}/share-links`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setShareLinks(response.data);
      setManageFileId(fileId);
    } catch (err) {
      console.error(err);

      showMessage("error", "Failed to load links");
    }
  };

  const handleRevokeLink = async (linkId) => {
    try {
      const token = localStorage.getItem("token");

      await api.patch(
        `/files/share-links/${linkId}/revoke`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setShareLinks((prev) =>
        prev.map((link) =>
          link.id === linkId
            ? {
                ...link,
                is_revoked: true,
              }
            : link,
        ),
      );
      showMessage("success", "Link revoked");
    } catch (err) {
      console.error(err);

      showMessage("error", "Failed to revoke link");
    }
  };

  const handleDeleteLink = async (linkId) => {
    try {
      const token = localStorage.getItem("token");

      await api.delete(`/files/share-links/${linkId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setShareLinks(shareLinks.filter((link) => link.id !== linkId));
      showMessage("success", "Link deleted");
    } catch (err) {
      console.error(err);

      showMessage("error", err.response?.data?.error || "Delete failed");
    }
  };

  const handleCopyLink = async (shareToken) => {
    try {
      const url = `${window.location.origin}/share/${shareToken}`;

      await navigator.clipboard.writeText(url);

      showMessage("success", "Link copied!");
    } catch (err) {
      console.error(err);

      showMessage("error", "Copy failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {message && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg border ${
            message.type === "success"
              ? "bg-green-900/80 border-green-500 text-green-200"
              : "bg-red-900/80 border-red-500 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
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
              disabled={uploading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition"
            >
              {uploading ? "Uploading..." : "Upload"}
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
                      Click filename to open
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
                          <button
                            onClick={() => {
                              handleManageLinks(file.id);

                              setOpenMenu(null);
                            }}
                            className="block w-full text-left px-4 py-3 hover:bg-[#21262d]"
                          >
                            Manage Links
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

      {manageFileId && (
        <div
          onClick={() => {
            setManageFileId(null);
          }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-162.5 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Share Links</h2>

              <button
                onClick={() => {
                  setManageFileId(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {shareLinks.length === 0 ? (
              <p className="text-gray-400">No share links found</p>
            ) : (
              <div className="space-y-4">
                {shareLinks.map((link) => (
                  <div
                    key={link.id}
                    className={`border rounded-xl p-4 ${
                      link.is_revoked
                        ? "border-red-500 opacity-60"
                        : "border-[#30363d]"
                    }`}
                  >
                    <p className="font-mono text-sm mb-2">
                      {link.share_token.slice(0, 12)}...
                    </p>

                    <div className="text-sm text-gray-400 mb-4">
                      <p>
                        Expires:{" "}
                        {link.expires_at
                          ? new Date(link.expires_at).toLocaleString()
                          : "Never"}
                      </p>

                      <p>Type: {link.is_one_time ? "One-Time" : "Normal"}</p>

                      <p
                        className={
                          link.is_revoked
                            ? "text-red-400"
                            : link.is_used
                              ? "text-yellow-400"
                              : "text-green-400"
                        }
                      >
                        Status:{" "}
                        {link.is_revoked
                          ? "Revoked"
                          : link.is_used
                            ? "Used"
                            : "Active"}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleCopyLink(link.share_token)}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
                      >
                        Copy
                      </button>

                      {!link.is_revoked && (
                        <button
                          onClick={() => handleRevokeLink(link.id)}
                          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm"
                        >
                          Revoke
                        </button>
                      )}
                      {link.is_revoked && (
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="
                            bg-gray-700
                            hover:bg-gray-800
                            px-4
                            py-2
                            rounded-lg
                            text-sm
                          "
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
