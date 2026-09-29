# DAEM - Plataforma de Gestion de Actividades Extraescolares

Sistema web completo (backend + frontend) en arquitectura **N capas con POO** para la gestion,
a nivel comunal, de actividades extraprogramaticas **deportivas** y **artistico/culturales**.

Proyecto **Mini - Programacion Orientada a Objetos** (replica del patron del proyecto ServiExpress).

## Roles

| Rol | Descripcion |
|-----|-------------|
| **Admin DAEM** | Control total de la plataforma a nivel comunal. |
| **Coordinador de Establecimiento** | Nexo DAEM <-> colegio asignado (un colegio por coordinador). |
| **Lector (Director de Establecimiento)** | Acceso de solo lectura a su establecimiento: nomina de estudiantes y agenda. |

## Funcionalidades principales

**Admin DAEM**
- Autenticacion por RUT + clave segura (bcrypt + JWT).
- Gestion de usuarios: crea Coordinadores y Lectores.
- Catalogo de establecimientos (codigo ej. `A-59`, `D-868`) y dependencia (Municipal / Particular Subvencionado).
- Publicacion y clasificacion de actividades por area (Deportiva | Artistico/Cultural) y division (MINIS, SUB 13, JUVENIL, DAMAS, VARONES).
- Gestion de calendario y recintos (fecha, hora, lugar fisico).
- Organizacion de torneos: formulario, grupos, semestre.
- **Sorteo y emparejamiento** de contrincantes nivelado por el valor/estado de cumplimiento del colegio.
- Control de solicitudes: aceptar/rechazar inscripciones.
- Registro de resultados, puntajes y posiciones (1º, 2º, 3º).
- Reportes y estadisticas: nomina, total de participaciones por establecimiento, total de beneficiarios (general y semestral).

**Coordinador**
- Gestion de Lectores (directores) de su colegio.
- Revisa la cartelera y se inscribe / rechaza la participacion de su colegio.
- Validacion de la categoria segun el anio de nacimiento (ej. 2013-2015 para SUB 13).
- Estado de solicitudes (aceptada / rechazada / en proceso) y opcion de retraccion dentro del plazo.
- Nomina interna de estudiantes.

**Lector (Director)**
- Consulta la nomina de estudiantes de su establecimiento (solo lectura).
- Consulta la agenda de encuentros (fechas, lugares, horas).

**Transversales**
- Valoracion / ranking de cumplimiento (cumple > regular > no_cumple) por establecimiento-actividad, base del sorteo.
- Trazabilidad historica por anio/semestre para comparar niveles de participacion.

## Arquitectura en N capas + POO

```
Cliente (SPA en /public)
   |
   v
API REST (Express)                 -> /routes
   |
   v
Controladores                       -> /controllers
   |
   v
Servicios (logica de negocio)      -> /services
   |
   v
Repositorios (Mongoose)            -> /repositories
   |
   v
SQlite (en memoria por defecto)   -> /models
```

### POO en /domain

| Clase | Descripcion | POO |
|-------|-------------|-----|
| `Persona` | Base: RUT con digito verificador, nombre, email, telefono | Encapsulamiento (#) con validaciones |
| `Usuario` | Hereda de Persona; rol + clave (bcrypt) | Herencia, polimorfismo de rol |
| `Alumno` | Hereda de Persona; fecha nacimiento, apoderado | Herencia |
| `Establecimiento` | Codigo, nombre, dependencia | Encapsulamiento |
| `Division` | Categoria; valida rango de nacimiento | Polimorfismo de validacion |
| `Actividad` | Area, divisiones, estado, calendario/recintos | Encapsulamiento |
| `Torneo` | Actividad, semestre, grupos, formulario | Encapsulamiento |
| `Inscripcion` | Ciclo de vida en_proceso -> aceptada/rechazada | Encapsulamiento, relacion |
| `Solicitud` | Solicitud interna establecimiento -> coordinador | Encapsulamiento |
| `Valoracion` | Ranking de cumplimiento | Encapsulamiento |
| `Resultado` | Puntajes, ganador, posicion | Encapsulamiento |
| `Sorteo` | Algoritmo de emparejamiento nivelado | Metodos estaticos + encapsulamiento |

## Estructura

```
DAEM/
├── server.js                # Punto de entrada
├── .env / .env.example
├── config/database.js       # Conexion MongoDB (memoria/Atlas/local)
├── constants/catalogos.js   # Reglas de negocio y catalogos
├── domain/                  # Clases POO
├── models/                  # Modelos Mongoose
├── repositories/            # Acceso a datos
├── services/                # Logica de negocio (incl. Sorteo y Reportes)
├── controllers/             # Controladores
├── routes/                  # Endpoints REST
├── middleware/              # auth + autorizarRol
├── seed/seed.js             # Datos iniciales de ejemplo
└── public/                  # Frontend SPA (index.html, css/, js/)
```

## Rutas del proyecto (indispensable para que funcione)

Para que el sistema corra **en cualquier otro dispositivo**, el proyecto **debe** ejecutarse
dentro de la carpeta **`DAEM/`**. Rutas criticas del backend que el servidor requiere
(al moverse, NO abre dentro de `DAEM/`):

```
DAEM/
└── server.js              # PUNTO DE ENTRADA:  node server.js
    ├── config/database.js # Conexion MongoDB (reproduccion local/memoria)
    ├── .env              # PORT, DB_MODO, JWT
    ├── package.json       # dependencias + script "npm start"
    ├── node_modules/     # npm install (o ya incluido)
    ├── seed/seed.js     # datos de ejemplo (inyecta al arrancar)
    ├── middleware/     # auth.js + validateRol.js
    ├── domain/        # clases POO
    ├── models/      # modelos Mongoose
    ├── repositories + services + controllers + routes   # backend

└── └── public/
        ├── index.html      # frontend SPA (login + paneles por rol)
        ├── css/estilos.css
        └── js/api.js  +  js/app.js
```

> Si se mueve a OTRA ruta BLOQUEA el arranque.
> Requisitos en otro dispositivo:
> 1. Mover la carpeta `DAEM/` a la raiz de su equipo.
> 2. `cd DAEM`
> 3. `npm install`  (genera `node_modules/` si NO vino incluido)
> 4. `npm start`     (levanta http://localhost:3000)

## Ambiente y base de datos

El proyecto usa **SQLite** como base de datos local por defecto. La conexión está configurada en [db/conexion.js](db/conexion.js) con `better-sqlite3` y la base se guarda en la carpeta `data/` dentro del proyecto.

En `.env` puedes definir opcionalmente:
- `PORT=3000` -> puerto del servidor.
- `DB_PATH=./data/daem.db` -> ruta personalizada de la base de datos.

La aplicación crea la base de datos automáticamente al iniciar y ejecuta el seed para dejar datos de ejemplo disponibles.

## Instalacion y ejecucion

Desde la raíz del proyecto:

```bash
npm install
npm start
```

También puedes arrancarlo directamente con:

```bash
node server.js
```

Abrir en el navegador: **http://localhost:3000**

Como el seed corre automaticamente en cada arranque, los datos de ejemplo siempre estaran disponibles.

## Usuarios de ejemplo

| Rol | RUT | Clave |
|-----|-----|-------|
| Admin DAEM | `11111111-1` | `admin123` |
| Coordinador P. Gonzalez (A-59) | `22222222-2` | `coord123` |
| Coordinador M. Fuentes (B-112) | `33333333-3` | `coord123` |
| Coordinador J. Rojas (C-204) | `44444444-4` | `coord123` |
| Coordinador C. Diaz (D-868) | `55555555-5` | `coord123` |
| Lector Director (A-59) | `88888888-8` | `director123` |
| Lector Director (B-112) | `99999999-9` | `director123` |
| Lector Director (C-204) | `10101010-4` | `director123` |
| Lector Director (D-868) | `77777777-7` | `director123` |

## Endpoints principales

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesion (RUT + clave) |
| GET | `/api/auth/me` | Perfil del usuario autenticado |
| CRUD | `/api/establecimientos` | Catalogo de colegios |
| CRUD | `/api/usuarios` | Admin/Coordinador gestionan usuarios |
| CRUD | `/api/actividades` + `/encuentros` | Actividades y calendario |
| CRUD | `/api/torneos` + `/:id/sorteo` | Torneos y sorteo |
| GET | `/api/torneos/:id/llaves` | Llaves del sorteo |
| POST | `/api/resultados/llaves/:id` | Registrar resultado |
| CRUD | `/api/inscripciones` + `/alumnos` | Inscripciones y alumnos |
| CRUD | `/api/solicitudes` | Solicitudes internas |
| GET | `/api/inscripciones/nomina` | Nomina por establecimiento (Coordinador / Lector) |
| POST | `/api/reportes/asignar` | Valoracion de cumplimiento (solo Admin) |
| GET | `/api/reportes/nomina|participaciones|beneficiarios|historico` | Reportes |
| GET | `/api/catalogos` | Catalogos para la SPA |

## Tecnologias

- **Node.js** + **Express.js** (API REST)
- **SQLite** con `better-sqlite3`
- **bcryptjs** + **jsonwebtoken** (seguridad)
- **POO** JavaScript ES6+ (encapsulamiento, herencia, polimorfismo)
- **Frontend SPA** en HTML/CSS/JS vanilla

## Analisis estatico con Semgrep

El proyecto ya incluye una configuracion basica para ejecutar escaneos de seguridad en el codigo fuente.

### Instalar Semgrep

```bash
python3 -m pip install --user semgrep
```

### Preparar el entorno

En un entorno Linux/macOS, crea un entorno virtual local del proyecto:

```bash
python3 -m venv .venv
```

Si usas Fish:

```fish
source .venv/bin/activate.fish
pip install semgrep
```

Si usas Bash/Zsh:

```bash
source .venv/bin/activate
pip install semgrep
```

### Ejecutar scan

Desde la raiz del proyecto:

```bash
npm run semgrep
```

O directamente:

```bash
./.venv/bin/semgrep --config semgrep.yml --error --severity WARNING .
```

La configuracion excluye carpetas generadas como `node_modules`, `data` y `.git`, y escanea archivos JavaScript/HTML del proyecto para detectar patrones de riesgo y codigo sospechoso.
