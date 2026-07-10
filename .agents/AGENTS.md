# SHALOM Backend — Règles du Projet

## Identité du Projet

- **Nom** : SHALOM
- **Type** : API REST Backend
- **Mission** : Plateforme chrétienne francophone de formation, mentorat, relation d'aide et réseau social pour les jeunes d'Afrique.

---

## Stack Technique

| Couche | Technologie |
|---|---|
| Runtime | Node.js |
| Framework | Express.js v5 |
| Base de données | PostgreSQL (via Supabase) |
| Driver DB | pg (node-postgres) |
| Authentification | JWT (jsonwebtoken) |
| Hash mots de passe | bcrypt |
| Validation | express-validator |
| Variables d'environnement | dotenv |

---

## Architecture — Clean Architecture

```
src/
├── config/           # Configuration globale (DB, env, constantes)
├── db/
│   └── migrations/   # Fichiers SQL de migration
├── modules/          # Modules métier (1 dossier = 1 domaine)
│   ├── auth/         # Authentification & inscription
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   ├── auth.routes.js
│   │   ├── auth.validator.js
│   │   └── auth.middleware.js
│   ├── posts/        # Publications
│   ├── comments/     # Commentaires
│   ├── likes/        # Likes
│   ├── follows/      # Abonnements
│   ├── groups/       # Groupes / Communautés
│   ├── messages/     # Messagerie
│   ├── notifications/# Notifications
│   ├── profiles/     # Profils utilisateurs
│   ├── reports/      # Signalements / Modération
│   └── credits/      # Transactions de crédits
├── middlewares/       # Middlewares globaux (auth, erreurs, rate-limit)
├── utils/             # Fonctions utilitaires réutilisables
└── app.js             # Point d'entrée Express
```

### Règles d'architecture

- **1 module = 1 dossier** dans `src/modules/`.
- Chaque module contient au maximum : `controller`, `service`, `routes`, `validator`, `middleware`.
- **Controller** : reçoit la requête, appelle le service, renvoie la réponse. Aucune logique métier.
- **Service** : contient toute la logique métier et les requêtes DB.
- **Routes** : définit les endpoints et applique les validateurs/middlewares.
- **Validator** : règles de validation express-validator.
- Les modules ne s'importent jamais entre eux directement. Utiliser les services si un module a besoin d'un autre.

---

## Conventions de Code

### Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Fichiers | kebab-case ou module.type.js | `auth.controller.js` |
| Variables | camelCase | `userId`, `postContent` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRY`, `JWT_SECRET` |
| Tables SQL | snake_case, pluriel | `credit_transactions` |
| Colonnes SQL | snake_case | `created_at`, `user_id` |
| Routes API | kebab-case, pluriel | `/api/v1/group-members` |

### Style

- Utiliser `const` par défaut, `let` si nécessaire, jamais `var`.
- Fonctions `async/await` — jamais de callbacks imbriqués.
- Toujours gérer les erreurs avec `try/catch`.
- Toujours retourner des réponses JSON structurées :

```json
{
  "success": true,
  "data": {},
  "message": "Opération réussie"
}
```

```json
{
  "success": false,
  "error": "Description de l'erreur",
  "code": "ERROR_CODE"
}
```

---

## Sécurité — Règles Obligatoires

- **JWT** pour toutes les routes protégées. Token dans le header `Authorization: Bearer <token>`.
- **bcrypt** avec un salt rounds de 12 minimum pour hasher les mots de passe.
- **express-validator** sur TOUTES les entrées utilisateur, sans exception.
- **Requêtes paramétrées** (`$1, $2`) — jamais de concaténation SQL.
- **Helmet.js** pour les headers HTTP de sécurité.
- **CORS** configuré strictement (origines autorisées uniquement).
- **Rate limiting** sur les routes sensibles (login, inscription, reset password).
- Ne jamais renvoyer le mot de passe ou des données sensibles dans les réponses API.
- Ne jamais logger de données sensibles (mots de passe, tokens).

---

## Base de Données — Règles

- **UUID** comme clé primaire pour toutes les tables (via `gen_random_uuid()`).
- **Soft Delete** : ne jamais supprimer physiquement. Ajouter `deleted_at TIMESTAMPTZ` et filtrer avec `WHERE deleted_at IS NULL`.
- **Timestamps** obligatoires : `created_at`, `updated_at` sur chaque table.
- **Foreign Keys** avec `ON DELETE CASCADE` ou `ON DELETE SET NULL` selon le contexte.
- **Index** sur toutes les colonnes fréquemment recherchées ou filtrées.
- **Types ENUM PostgreSQL** pour les valeurs à choix restreint.
- Les migrations sont numérotées séquentiellement : `001_`, `002_`, etc.
- Chaque migration est un fichier SQL indépendant et idempotent si possible.

---

## API — Conventions REST

- Préfixer toutes les routes avec `/api/v1/`.
- Verbes HTTP :
  - `GET` — lecture
  - `POST` — création
  - `PUT` — mise à jour complète
  - `PATCH` — mise à jour partielle
  - `DELETE` — suppression (soft delete)
- Pagination sur toutes les listes : `?page=1&limit=20`.
- Codes HTTP standards :
  - `200` — succès
  - `201` — création réussie
  - `400` — erreur de validation
  - `401` — non authentifié
  - `403` — non autorisé
  - `404` — ressource non trouvée
  - `409` — conflit (doublon)
  - `429` — trop de requêtes
  - `500` — erreur serveur

---

## Variables d'Environnement

Toutes les configurations sensibles dans `.env` (jamais committé) :

```env
# Serveur
PORT=3000
NODE_ENV=development

# Base de données
DATABASE_URL=postgresql://user:password@host:5432/shalom_db

# JWT
JWT_SECRET=votre_secret_jwt
JWT_EXPIRES_IN=7d

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=votre_cle_supabase
```

---

## Tests

- Tester chaque service avec des tests unitaires.
- Tester chaque route avec des tests d'intégration.
- Utiliser un fichier `.env.test` pour les tests.

---

## Git — Conventions de Commits

Format : `type(scope): description`

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `refactor` | Refactoring sans changement fonctionnel |
| `docs` | Documentation |
| `test` | Ajout ou modification de tests |
| `chore` | Maintenance, dépendances |
| `security` | Correctif de sécurité |

Exemples :
- `feat(auth): ajouter l'inscription par email`
- `fix(posts): corriger la pagination du feed`
- `security(auth): ajouter le rate limiting sur /login`

---

## Langue

- **Code** : anglais (noms de variables, fonctions, classes).
- **Commentaires** : français.
- **Messages API** : français (destinés aux utilisateurs francophones).
- **Documentation** : français.
