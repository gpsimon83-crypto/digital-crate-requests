-- New "reports.view" capability for the deeper Reports page — revenue by
-- DJ is financially sensitive, same access tier as finance.view_company
-- (owner/admin/manager, not dj/client).
insert into permissions (role, capability) values
  ('owner', 'reports.view'),
  ('admin', 'reports.view'),
  ('manager', 'reports.view')
on conflict (role, capability) do nothing;
