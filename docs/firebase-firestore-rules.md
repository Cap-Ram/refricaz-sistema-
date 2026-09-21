# Reglas de Firestore para REFRICAZ

Estas reglas viven en `firestore.rules` y se despliegan con:

```powershell
firebase deploy --only firestore:rules
```

Permiten:
- Crear leads desde la pagina publica.
- Registrar usuarios con Firebase Auth y guardarlos en `users`.
- Dar/quitar rol `admin` desde el panel, solo si ya eres admin.
- Crear comentarios solo con usuario autenticado.
- Moderar comentarios desde el panel admin.

El primer admin autorizado es:

```txt
ali.ramses.perez.martinez@gmail.com
```

