# Routes API — SHALOM Backend

Ce document recense l'intégralité des routes REST implémentées et actives à ce jour dans l'application.
*Toutes les routes (à l'exception de la route de santé et des routes d'authentification) requièrent un token JWT via le header `Authorization: Bearer <token>`.*

---

## 🟢 Route globale de santé

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Vérifier l'état du serveur |

---

## 🔐 1. Authentification (`/api/v1/auth`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Inscription d'un nouvel utilisateur |
| `POST` | `/api/v1/auth/login` | Connexion utilisateur (génère access + refresh tokens) |
| `POST` | `/api/v1/auth/refresh` | Rafraîchir un token d'accès expiré via un refresh token |

---

## 👤 2. Profils (`/api/v1/profiles`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/profiles/me` | Récupérer le profil de l'utilisateur connecté |
| `PATCH` | `/api/v1/profiles/me` | Mettre à jour le profil de l'utilisateur connecté |

---

## 📝 3. Publications / Posts (`/api/v1/posts`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/posts/` | Récupérer le fil d'actualité (feed) avec pagination |
| `POST` | `/api/v1/posts/` | Créer une nouvelle publication |
| `GET` | `/api/v1/posts/:id` | Récupérer les détails d'une publication spécifique |
| `PATCH` | `/api/v1/posts/:id` | Mettre à jour une publication (contenu) |
| `DELETE`| `/api/v1/posts/:id` | Supprimer une publication (soft delete) |

---

## 💬 4. Commentaires (`/api/v1/comments`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/comments/post/:postId`| Lister les commentaires d'une publication avec pagination |
| `POST` | `/api/v1/comments/post/:postId`| Ajouter un nouveau commentaire sous une publication |
| `DELETE`| `/api/v1/comments/:id` | Supprimer un commentaire (soft delete) |

---

## ❤️ 5. Likes (`/api/v1/likes`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/likes/` | Ajouter un like à un contenu (post ou commentaire) |
| `DELETE`| `/api/v1/likes/` | Retirer son like d'un contenu |

---

## 👥 6. Abonnements / Follows (`/api/v1/follows`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/follows/` | Suivre un autre utilisateur |
| `DELETE`| `/api/v1/follows/:followedId` | Se désabonner d'un utilisateur |
| `GET` | `/api/v1/follows/user/:userId/followers` | Lister les abonnés d'un utilisateur donné |
| `GET` | `/api/v1/follows/user/:userId/following` | Lister les abonnements d'un utilisateur donné |
| `GET` | `/api/v1/follows/user/:userId/follow-status`| Vérifier le statut de suivi entre le requester et l'utilisateur |

---

## 🌍 7. Groupes (`/api/v1/groups`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/groups/` | Lister et rechercher des groupes avec pagination |
| `POST` | `/api/v1/groups/` | Créer un nouveau groupe |
| `GET` | `/api/v1/groups/:id` | Obtenir les détails complets d'un groupe |
| `PATCH` | `/api/v1/groups/:id` | Mettre à jour un groupe (réservé aux admins du groupe) |
| `DELETE`| `/api/v1/groups/:id` | Supprimer un groupe (réservé au propriétaire) |
| `POST` | `/api/v1/groups/:id/members` | Demander à rejoindre un groupe / Rejoindre |
| `GET` | `/api/v1/groups/:id/members` | Lister les membres d'un groupe |
| `DELETE`| `/api/v1/groups/:id/members/:userId` | Retirer un membre ou quitter le groupe soi-même |
| `PATCH` | `/api/v1/groups/:id/members/:userId/role` | Mettre à jour le rôle d'un membre (ex: passer admin) |
| `PATCH` | `/api/v1/groups/:id/members/:userId/status`| Mettre à jour le statut d'un membre (ex: approuver adhésion) |

---

## ✉️ 8. Messagerie / Conversations (`/api/v1/conversations`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/conversations/` | Lister les conversations de l'utilisateur (Inbox) |
| `POST` | `/api/v1/conversations/` | Initier une nouvelle conversation avec un utilisateur |
| `GET` | `/api/v1/conversations/:id/messages` | Lister les messages d'une conversation spécifique |
| `POST` | `/api/v1/conversations/:id/messages` | Envoyer un message dans la conversation |
| `PATCH` | `/api/v1/conversations/:id/read` | Marquer tous les messages d'une conversation comme lus |

---

## 🔔 9. Notifications (`/api/v1/notifications`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/notifications/` | Lister les notifications de l'utilisateur avec pagination |
| `GET` | `/api/v1/notifications/unread-count` | Obtenir le compteur de notifications non lues |
| `PATCH` | `/api/v1/notifications/read-all` | Marquer toutes ses notifications comme lues |
| `PATCH` | `/api/v1/notifications/:id/read` | Marquer une notification spécifique comme lue |

---

## 🚨 10. Signalements / Reports (`/api/v1/reports`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/reports/` | Signaler un contenu inapproprié (post ou commentaire) |
| `GET` | `/api/v1/reports/` | Lister les signalements *(Réservé aux Administrateurs)* |
| `PATCH` | `/api/v1/reports/:id` | Traiter et mettre à jour le statut d'un signalement *(Admin)* |
