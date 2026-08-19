# Login privado Ticket to Pipeline

Este paquete reemplaza la autenticación Basic Auth por una pantalla de login propia, solo con contraseña.

## Archivos incluidos

- proxy.ts
- app/login/page.tsx
- app/api/login/route.ts
- app/api/logout/route.ts
- app/DashboardClient.tsx
- app/globals.css

## Importante

Borra el archivo anterior si existe:

- middleware.ts

Si ya tenías `proxy.ts` de Basic Auth, reemplázalo por este.

## Variables necesarias

En `.env.local`:

DASHBOARD_PASSWORD=tu_password_seguro
DASHBOARD_SESSION_SECRET=una_frase_larga_random_para_la_cookie

En Vercel:
Project Settings → Environment Variables

Agregar:
- DASHBOARD_PASSWORD
- DASHBOARD_SESSION_SECRET

Ya no necesitas usar `DASHBOARD_USERNAME` para este login.

## Probar

npm run dev

Abrir:
http://localhost:3000

Debe redirigir a:
http://localhost:3000/login

## Subir

git add proxy.ts app/login/page.tsx app/api/login/route.ts app/api/logout/route.ts app/DashboardClient.tsx app/globals.css
git rm middleware.ts
git commit -m "Add custom password login"
git push
