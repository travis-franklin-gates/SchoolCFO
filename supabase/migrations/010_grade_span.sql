-- Replace single grade_config with separate grade span fields
alter table schools add column if not exists grades_current_first text not null default '';
alter table schools add column if not exists grades_current_last text not null default '';
alter table schools add column if not exists grades_buildout_first text not null default '';
alter table schools add column if not exists grades_buildout_last text not null default '';

-- Migrate existing grade_config data (e.g. "K-5" → first="K", last="5")
update schools
set grades_current_first = split_part(grade_config, '-', 1),
    grades_current_last = split_part(grade_config, '-', 2),
    grades_buildout_first = split_part(grade_config, '-', 1),
    grades_buildout_last = split_part(grade_config, '-', 2)
where grade_config is not null and grade_config != '';
