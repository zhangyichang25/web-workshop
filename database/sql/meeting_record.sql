-- PostgreSQL: 第 3 讲“实时会议记录”
create table if not exists public.meeting_record (
  uuid uuid default gen_random_uuid() not null,
  room_uuid uuid not null,
  content text not null default '',
  created_at timestamp default current_timestamp not null,
  updated_at timestamp default current_timestamp not null,
  primary key (uuid),
  foreign key (room_uuid) references public.room (uuid) on update cascade on delete cascade
);
