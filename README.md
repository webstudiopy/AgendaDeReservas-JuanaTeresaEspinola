# Agenda Pro Eventos — GitHub Pages + Supabase

Versión actualizada para usar **sin login** y **sin tocar otra agenda** dentro del mismo proyecto de Supabase.

## Qué hace

- Guarda reservas en la tabla `reservas_eventos`
- No permite fechas duplicadas activas
- Si la fecha ya existe, muestra: **“ya está reservada por tal persona”**
- Permite **finalizar** o **cancelar**
- Si una reserva se **cancela**, la fecha vuelve a quedar libre
- Diseño elegante con Bootstrap 5
- Lista para subir a **GitHub Pages**

## Importante

Esta versión usa **otra tabla**:

```text
reservas_eventos
```

Así no afecta a la otra agenda que ya tengas dentro del mismo proyecto de Supabase.

---

## 1) Crear la tabla en Supabase

Entrá a tu proyecto en Supabase y luego:

**SQL Editor → New query**

Copiá y ejecutá todo el archivo:

```text
supabase/schema.sql
```

Ese script crea:

- la tabla `reservas_eventos`
- el índice único para bloquear fechas duplicadas activas
- las políticas RLS para usarlo sin login

---

## 2) Configurar la conexión

Abrí este archivo:

```text
js/config.js
```

Y pegá tus datos reales:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_ANON_KEY',
  TABLE_NAME: 'reservas_eventos'
};
```

Los datos están en:

**Supabase → Project Settings → API**

Copiá:

- Project URL
- anon public key

---

## 3) Cómo funciona la lógica de fechas

Estados:

- `reservado` → bloquea la fecha
- `finalizado` → mantiene la fecha ocupada
- `cancelado` → libera la fecha

Por eso:

- si el 15/04 está reservado por **María**, no deja guardar otra reserva ese día
- si luego esa reserva se marca como **cancelada**, la fecha se puede volver a usar

---

## 4) Publicar en GitHub Pages

Subí estos archivos a un repositorio y activá GitHub Pages.

No necesitás backend extra.
La web consulta directo a Supabase.

---

## Archivos principales

- `index.html`
- `css/style.css`
- `js/config.js`
- `js/app.js`
- `supabase/schema.sql`

---

## Nota de seguridad

Como va **sin login**, cualquiera que tenga acceso al link puede ver y modificar reservas.

Para una versión comercial más segura, después conviene agregar:

- PIN oculto
- panel privado
- usuario administrador

Pero para una agenda simple de uso interno, esta versión funciona bien.
