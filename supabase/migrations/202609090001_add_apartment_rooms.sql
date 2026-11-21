begin;
alter table public.homes drop constraint homes_plot_check;
alter table public.homes add constraint homes_plot_check check (plot between 0 and 17);
commit;
