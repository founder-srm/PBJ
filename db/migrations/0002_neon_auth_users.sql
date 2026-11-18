-- Link the app's users to Neon Auth (Better Auth). Sign-in lives in the neon_auth schema;
-- users.id is the Neon Auth user id, and the row is created the first time a signed-in user hits the app.

alter table users drop column google_sub;

alter table users alter column id drop default;

alter table users add constraint users_auth_user_fk foreign key (id) references neon_auth."user" (id) on delete cascade;

-- Who registered the team (always its leader, member position 1).
alter table teams add column created_by uuid references users (id);

create index teams_created_by_idx on teams (created_by);
