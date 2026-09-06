-- PostgreSQL: 第 3 讲“便签纸”。每位用户在每个会议中至多一张便签。
create table if not exists public.room_note (
  uuid uuid default gen_random_uuid() not null,
  user_uuid uuid not null,
  room_uuid uuid not null,
  content text not null default '',
  created_at timestamp default current_timestamp not null,
  updated_at timestamp default current_timestamp not null,
  primary key (uuid),
  unique (user_uuid, room_uuid),
  foreign key (user_uuid) references public.user (uuid) on update cascade on delete cascade,
  foreign key (room_uuid) references public.room (uuid) on update cascade on delete cascade
);
