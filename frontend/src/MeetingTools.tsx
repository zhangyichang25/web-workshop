import { useEffect, useState } from "react";
import { gql, useMutation, useQuery, useSubscription } from "@apollo/client";
import { Button, Input, List, message } from "antd";
import { user } from "./getUser";

const RECORDS = gql`
  subscription meetingRecords($room_uuid: uuid!) {
    meeting_record(where: {room_uuid: {_eq: $room_uuid}}, order_by: {created_at: asc}) {
      uuid content created_at updated_at
    }
  }
`;
const ADD_RECORD = gql`
  mutation addRecord($room_uuid: uuid!, $content: String!) {
    insert_meeting_record_one(object: {room_uuid: $room_uuid, content: $content}) { uuid }
  }
`;
const UPDATE_RECORD = gql`
  mutation updateRecord($uuid: uuid!, $content: String!, $updated_at: timestamp!) {
    update_meeting_record_by_pk(pk_columns: {uuid: $uuid}, _set: {content: $content, updated_at: $updated_at}) { uuid }
  }
`;
const NOTE = gql`
  query roomNote($user_uuid: uuid!, $room_uuid: uuid!) {
    room_note(where: {user_uuid: {_eq: $user_uuid}, room_uuid: {_eq: $room_uuid}}) { uuid content }
  }
`;
const SAVE_NOTE = gql`
  mutation saveNote($user_uuid: uuid!, $room_uuid: uuid!, $content: String!, $updated_at: timestamp!) {
    insert_room_note_one(
      object: {user_uuid: $user_uuid, room_uuid: $room_uuid, content: $content, updated_at: $updated_at},
      on_conflict: {constraint: room_note_user_uuid_room_uuid_key, update_columns: [content, updated_at]}
    ) { uuid }
  }
`;

interface MeetingToolsProps {
  roomUUID: string;
  user: user;
}

const MeetingTools: React.FC<MeetingToolsProps> = ({ roomUUID, user }) => {
  const [recordText, setRecordText] = useState("");
  const [noteText, setNoteText] = useState("");
  const { data: recordsData } = useSubscription<any>(RECORDS, { variables: { room_uuid: roomUUID } });
  const { data: noteData } = useQuery<any>(NOTE, { variables: { user_uuid: user.uuid, room_uuid: roomUUID } });
  const [addRecord] = useMutation(ADD_RECORD);
  const [updateRecord] = useMutation(UPDATE_RECORD);
  const [saveNote] = useMutation(SAVE_NOTE);

  useEffect(() => {
    setNoteText(noteData?.room_note?.[0]?.content ?? "");
  }, [noteData]);

  const createRecord = async () => {
    if (!recordText.trim()) return;
    try {
      await addRecord({ variables: { room_uuid: roomUUID, content: recordText.trim() } });
      setRecordText("");
    } catch (error) {
      console.error(error);
      message.error("添加会议记录失败");
    }
  };

  const saveCurrentNote = async () => {
    try {
      await saveNote({ variables: { user_uuid: user.uuid, room_uuid: roomUUID, content: noteText, updated_at: new Date().toISOString() } });
      message.success("便签已保存");
    } catch (error) {
      console.error(error);
      message.error("保存便签失败");
    }
  };

  return (
    <details className="need-interaction" style={{ width: "100%", marginBottom: 8 }}>
      <summary>会议记录与我的便签</summary>
      <Input.TextArea
        value={recordText}
        onChange={(event) => setRecordText(event.target.value)}
        placeholder="添加一条实时会议记录"
        autoSize={{ minRows: 1, maxRows: 3 }}
        style={{ marginTop: 6 }}
      />
      <Button size="small" onClick={createRecord} style={{ marginTop: 4 }}>添加记录</Button>
      <List
        size="small"
        dataSource={recordsData?.meeting_record ?? []}
        renderItem={(record: any) => (
          <List.Item>
            <Input.TextArea
              defaultValue={record.content}
              autoSize
              onBlur={async (event) => {
                if (event.target.value !== record.content) {
                  await updateRecord({ variables: { uuid: record.uuid, content: event.target.value, updated_at: new Date().toISOString() } });
                }
              }}
            />
          </List.Item>
        )}
      />
      <Input.TextArea
        value={noteText}
        onChange={(event) => setNoteText(event.target.value)}
        onBlur={saveCurrentNote}
        placeholder="仅自己可见的会议便签（失焦自动保存）"
        autoSize={{ minRows: 2, maxRows: 5 }}
      />
    </details>
  );
};

export default MeetingTools;
