import { useEffect, useRef, useState } from "react";
import { gql, useMutation, useQuery, useSubscription } from "@apollo/client";
import { Button, Mentions, message, Modal, Spin, Tag } from "antd";
import { user } from "./getUser";
import * as graphql from "./graphql";
import { Bubble, Card, Container, Scroll, Text } from "./Components";
import MeetingTools from "./MeetingTools";

const MESSAGES = gql`
  subscription messages($room_uuid: uuid!) {
    message(where: {room_uuid: {_eq: $room_uuid}}, order_by: {created_at: asc}) {
      uuid content created_at user_uuid reply_to_message_uuid
      user { uuid username }
      reply_to_message { uuid content user { username } }
    }
  }
`;
const ADD_MESSAGE = gql`
  mutation addMessage($user_uuid: uuid!, $room_uuid: uuid!, $content: String!, $reply_to_message_uuid: uuid) {
    insert_message_one(object: {user_uuid: $user_uuid, room_uuid: $room_uuid, content: $content, reply_to_message_uuid: $reply_to_message_uuid}) { uuid }
  }
`;
const DELETE_MESSAGE = gql`mutation deleteMessage($uuid: uuid!) { delete_message_by_pk(uuid: $uuid) { uuid } }`;
const MEMBERS = gql`query members($room_uuid: uuid!) { user_room(where: {room_uuid: {_eq: $room_uuid}}) { user { uuid username } } }`;

interface ChatBoxProps {
  user: user | null;
  room: graphql.GetJoinedRoomsQuery["user_room"][0]["room"] | undefined;
  handleClose: () => void;
}
type ChatMessage = {
  uuid: string; content: string; created_at: string; user_uuid: string;
  user: { uuid: string; username: string };
  reply_to_message_uuid?: string | null;
  reply_to_message?: { uuid: string; content: string; user: { username: string } } | null;
};

const ChatBox: React.FC<ChatBoxProps> = ({ user, room, handleClose }) => {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const { data, error } = useSubscription<any>(MESSAGES, { skip: !room, variables: { room_uuid: room?.uuid } });
  const { data: memberData } = useQuery<any>(MEMBERS, { skip: !room, variables: { room_uuid: room?.uuid } });
  const [addMessage] = useMutation(ADD_MESSAGE);
  const [deleteMessage] = useMutation(DELETE_MESSAGE);

  useEffect(() => { if (error) { console.error(error); message.error("获取消息失败！"); } }, [error]);
  if (!user || !room) return null;

  const send = async () => {
    if (!text.trim()) return message.error("消息不能为空！");
    setLoading(true);
    try {
      await addMessage({ variables: { user_uuid: user.uuid, room_uuid: room.uuid, content: text.trim(), reply_to_message_uuid: replyTo?.uuid ?? null } });
      setText("");
      setReplyTo(null);
    } catch (error) {
      console.error(error);
      message.error("发送消息失败！");
    } finally { setLoading(false); }
  };
  const contextAction = (event: React.MouseEvent, item: ChatMessage) => {
    event.preventDefault();
    const isRecentSelfMessage = item.user_uuid === user.uuid && Date.now() - new Date(item.created_at).getTime() <= 2 * 60 * 1000;
    if (isRecentSelfMessage) {
      Modal.confirm({
        title: "撤回消息",
        content: "此消息发送未满两分钟，确定撤回吗？",
        okText: "撤回",
        onOk: async () => {
          try { await deleteMessage({ variables: { uuid: item.uuid } }); message.success("消息已撤回"); }
          catch (error) { console.error(error); message.error("撤回失败"); }
        },
      });
      return;
    }
    if (item.reply_to_message_uuid) return message.info("不能回复一条回复消息");
    setReplyTo(item);
    message.info("正在回复 " + item.user.username + " 的消息");
  };
  const memberOptions = [
    { value: "All", label: "All" },
    ...((memberData?.user_room ?? []).map((item: any) => ({ value: item.user.username, label: item.user.username }))),
  ];

  return (
    <Card style={{ width: "340px", height: "560px" }}>
      <Button type="link" className="need-interaction" style={{ position: "absolute", right: 0, top: 0 }} onClick={handleClose}>❌</Button>
      <Container style={{ margin: "6px", alignItems: "stretch" }}>
        <Text><strong>{room.name}</strong></Text>
        <Text size="small" style={{ marginTop: 6, marginBottom: 6 }}>{room.intro}</Text>
        <MeetingTools roomUUID={room.uuid} user={user} />
      </Container>
      <MessageFeed currentUser={user} messages={data?.message} onContextAction={contextAction} />
      {replyTo && <Tag closable onClose={() => setReplyTo(null)} color="blue">回复 @{replyTo.user.username}：{replyTo.content.slice(0, 18)}</Tag>}
      <div className="need-interaction" style={{ marginTop: 8, display: "flex", width: "100%" }}>
        <Mentions style={{ flex: 1, fontSize: 16 }} value={text} onChange={setText} options={memberOptions} placeholder="输入消息；输入 @ 可选择成员或 @All" />
        <Button style={{ marginLeft: 8 }} onClick={send} type="primary" loading={loading}>发送</Button>
      </div>
    </Card>
  );
};

const MessageFeed: React.FC<{ currentUser: user; messages?: ChatMessage[]; onContextAction: (event: React.MouseEvent, item: ChatMessage) => void }> = ({ currentUser, messages, onContextAction }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return <Scroll style={{ flex: 1 }}>{messages ? messages.map((item, index) => <div ref={index === messages.length - 1 ? bottomRef : null} key={item.uuid}><MessageBubble currentUser={currentUser} item={item} onContextAction={onContextAction} /></div>) : <Container style={{ height: "100%" }}><Spin size="large" /></Container>}</Scroll>;
};

const MessageBubble: React.FC<{ currentUser: user; item: ChatMessage; onContextAction: (event: React.MouseEvent, item: ChatMessage) => void }> = ({ currentUser, item, onContextAction }) => {
  const isSelf = currentUser.uuid === item.user_uuid;
  const mentioned = item.content.includes("@All") || item.content.includes("@" + currentUser.username);
  return <div onContextMenu={(event) => onContextAction(event, item)} style={{ margin: "6px 0", display: "flex", flexDirection: "column", alignItems: isSelf ? "flex-end" : "flex-start" }}>
    <div style={{ margin: "0 12px" }}><Text size="small">{item.user.username}</Text><Text size="small" style={{ marginLeft: 6 }}>{new Date(item.created_at).toLocaleString("zh-CN")}</Text>{mentioned && <Tag color="orange">@我</Tag>}</div>
    <Bubble style={{ maxWidth: "85%", backgroundColor: mentioned ? "rgba(255, 196, 0, 0.25)" : isSelf ? "rgba(4, 190, 2, 0.25)" : "rgba(255, 255, 255, 0.25)" }}>
      {item.reply_to_message && <Text size="small" style={{ display: "block", opacity: 0.7 }}>回复 @{item.reply_to_message.user.username}：{item.reply_to_message.content}</Text>}
      <Text style={{ wordBreak: "break-all" }}>{item.content}</Text>
    </Bubble>
  </div>;
};

export default ChatBox;
