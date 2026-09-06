import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import md5 from "md5";
import { Button, Card, Form, Input, message } from "antd";

export const PasswordResetRequestPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const submit = async ({ username }: { username: string }) => {
    setLoading(true);
    try {
      await axios.post("/user/change-password/request", { username });
      message.success("重置链接已发送，请查收邮箱");
      form.resetFields();
    } catch (error) {
      console.error(error);
      message.error("发送失败，请确认邮箱已注册且邮件配置可用");
    } finally {
      setLoading(false);
    }
  };
  return <Card title="找回密码" style={{ maxWidth: 420, margin: "10vh auto" }}><Form form={form} onFinish={submit}><Form.Item name="username" rules={[{ required: true, type: "email", message: "请输入注册邮箱" }]}><Input placeholder="注册邮箱" /></Form.Item><Button htmlType="submit" type="primary" loading={loading}>发送重置链接</Button></Form></Card>;
};

export const PasswordResetActionPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const submit = async ({ newPassword }: { newPassword: string }) => {
    const token = params.get("token");
    if (!token) return message.error("重置链接缺少 token");
    setLoading(true);
    try {
      await axios.post("/user/change-password/action", { token, newPassword: md5(newPassword) });
      message.success("密码已更新，请重新登录");
      navigate("/login");
    } catch (error) {
      console.error(error);
      message.error("重置失败，链接可能已经过期");
    } finally {
      setLoading(false);
    }
  };
  return <Card title="设置新密码" style={{ maxWidth: 420, margin: "10vh auto" }}><Form onFinish={submit}><Form.Item name="newPassword" rules={[{ required: true, min: 6, message: "密码至少 6 位" }]}><Input.Password placeholder="新密码" /></Form.Item><Button htmlType="submit" type="primary" loading={loading}>更新密码</Button></Form></Card>;
};
