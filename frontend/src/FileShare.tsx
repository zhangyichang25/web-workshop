import { useEffect, useState } from "react";
import { Button, Image, List, message, Modal, Spin, Upload } from "antd";
import {
  InboxOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import * as graphql from "./graphql";
import { Card, Container, Scroll, Text } from "./Components";

const { Dragger } = Upload;

interface FileShareProps {
  room: graphql.GetJoinedRoomsQuery["user_room"][0]["room"] | undefined;
  handleClose: () => void;
}

const fetchFileList = async (roomUUID: string) => {
  try {
    const response = await axios.get("/file/list?room=" + roomUUID);
    return response.data.fileList;
  } catch (error) {
    console.error(error);
    message.error("获取文件列表失败！");
    return [];
  }
};

const downloadFile = async (roomUUID: string, filename: string) => {
  try {
    message.info("正在请求下载...");
    const response = await axios.get("/file/download?room=" + roomUUID + "&filename=" + filename, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    message.success("开始下载文件！");
  } catch (error) {
    console.error(error);
    message.error("下载文件失败！");
  }
};

const getFileBlobUrl = async (roomUUID: string, filename: string) => {
  const response = await axios.get("/file/download?room=" + roomUUID + "&filename=" + filename, { responseType: "blob" });
  return window.URL.createObjectURL(response.data);
};

const FileShare: React.FC<FileShareProps> = ({ room, handleClose }) => {
  const [fileList, setFileList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState<string>("");
  const [preview, setPreview] = useState<{ filename: string; url: string } | null>(null);

  const filteredFileList = fileList.filter((filename) =>
  filename.includes(searchText)
);
  useEffect(() => {
    if (room) {
      fetchFileList(room.uuid).then(setFileList);
    }
  }, [room]);

  const uploadFile = async (file: File, onSuccess: any, onError: any) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post("/file/upload/" + room?.uuid, formData);
      await fetchFileList(room?.uuid).then(setFileList);
      message.success("上传文件成功！");
      onSuccess?.();
    } catch (error) {
      console.error(error);
      message.error("上传文件失败！");
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (room) {
      fetchFileList(room.uuid).then(setFileList);
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const deleteFile = async (filename: string) => {
    try {
      await axios.post("/file/delete", { room: room?.uuid, filename });
      setFileList((items) => items.filter((item) => item !== filename));
      message.success("文件已删除");
    } catch (error) {
      console.error(error);
      message.error("删除文件失败");
    }
  };

  const previewFile = async (filename: string) => {
    if (!/(\.pdf|\.png|\.jpe?g|\.gif|\.webp)$/i.test(filename)) {
      message.info("目前支持预览 PDF 和常见图片，请使用下载查看其他文件");
      return;
    }
    try {
      const url = await getFileBlobUrl(room!.uuid, filename);
      setPreview({ filename, url });
    } catch (error) {
      console.error(error);
      message.error("文件预览加载失败");
    }
  };

  const Refresh = () => (
    <Button
      type="link"
      style={{
        width: "40px",
        height: "40px",
        fontSize: "16px",
        position: "absolute",
        left: 0,
        top: 0,
      }}
      className="need-interaction"
      onClick={handleRefresh}
    >
      <ReloadOutlined spin={refreshing} />
    </Button>
  );

  const Close = () => (
    <Button
      type="link"
      style={{
        width: "40px",
        height: "40px",
        fontSize: "12px",
        position: "absolute",
        right: 0,
        top: 0,
      }}
      className="need-interaction"
      onClick={handleClose}
    >
      ❌
    </Button>
  );

  if (!room) {
    return null;
  }
  return (
    <Card style={{ width: "300px", height: "500px" }}>
      <Refresh />
      <Close />
      <Container style={{ margin: "6px" }}>
        <Text>
          <strong>{room.name}</strong>
        </Text>
        <Text size="small" style={{ marginTop: "6px", marginBottom: "6px" }}>
          文件共享空间
        </Text>
      </Container>
      <input
        className="need-interaction"
        style={{
          width: "calc(100% - 12px)",
          marginBottom: "6px",
        }}
        placeholder="输入文件名搜索"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
      />
      {searchText && filteredFileList.length === 0 ? (
        <Text size="small" style={{ marginBottom: "6px" }}>
          未找到匹配文件
        </Text>
      ) : (
        <FileList roomUUID={room.uuid} filelist={filteredFileList} onDelete={deleteFile} onPreview={previewFile} />
      )}
      <Modal
        open={Boolean(preview)}
        title={preview?.filename}
        footer={null}
        onCancel={() => {
          if (preview) window.URL.revokeObjectURL(preview.url);
          setPreview(null);
        }}
        width={760}
      >
        {preview?.filename.toLowerCase().endsWith(".pdf") ? (
          <iframe title={preview.filename} src={preview.url} style={{ width: "100%", height: "65vh", border: 0 }} />
        ) : preview ? <Image src={preview.url} style={{ maxWidth: "100%" }} /> : null}
      </Modal>
    </Card>
  );
};

interface FileListProps {
  roomUUID: string;
  filelist: string[];
  onDelete: (filename: string) => Promise<void>;
  onPreview: (filename: string) => Promise<void>;
}

const FileList: React.FC<FileListProps> = ({ roomUUID, filelist, onDelete, onPreview }) => {
  const Download = (filename: string) => (
    <Button
      type="link"
      style={{ fontSize: "18px", width: "18px", height: "18px", padding: 0 }}
      onClick={async () => await downloadFile(roomUUID, filename)}
    >
      <DownloadOutlined />
    </Button>
  );
  const Preview = (filename: string) => (
    <Button type="link" style={{ fontSize: "12px", padding: 0 }} onClick={() => onPreview(filename)}>预览</Button>
  );
  const Delete = (filename: string) => (
    <Button danger type="link" style={{ padding: 0 }} onClick={() => Modal.confirm({ title: "删除文件", content: filename, okText: "删除", okButtonProps: { danger: true }, onOk: () => onDelete(filename) })}><DeleteOutlined /></Button>
  );
  return (
    <Scroll>
      <List
        size="small"
        dataSource={filelist}
        renderItem={(filename) => (
          <List.Item style={{ padding: "8px" }} actions={[Preview(filename), Download(filename), Delete(filename)]}>
            <Text style={{ wordBreak: "break-all" }}>{filename}</Text>
          </List.Item>
        )}
      />
    </Scroll>
  );
};

export default FileShare;
