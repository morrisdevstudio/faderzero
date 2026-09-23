DROP POLICY IF EXISTS design_icon_roles_admin_all ON public.design_icon_roles;

CREATE POLICY design_icon_roles_admin_all
ON public.design_icon_roles FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  updated_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = (SELECT auth.uid())
  )
);
