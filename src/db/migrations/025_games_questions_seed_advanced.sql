-- ============================================================================
-- Migration: 025_games_questions_seed_advanced.sql
-- Module: SHALOM Games — banque de questions difficulté 2 (intermédiaire) et
-- 3 (expert), 6 questions par jeu et par niveau (36 questions au total).
-- Complète le seed difficulté 1 de la migration 023.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUIZ BIBLIQUE — difficulté 2
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'ancien-testament'),
    'mcq', 2, 'Quel roi d''Israël demanda la sagesse à Dieu plutôt que la richesse ?',
    'Dieu apparut à Salomon en songe et exauça sa demande de sagesse pour gouverner le peuple.',
    '1 Rois 3', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Salomon', true, 1), ('David', false, 2), ('Ézéchias', false, 3), ('Josias', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'ancien-testament'),
    'mcq', 2, 'Combien de plaies Dieu envoya-t-il sur l''Égypte avant que Pharaon libère les Hébreux ?',
    'Les dix plaies d''Égypte sont racontées en Exode 7 à 12.',
    'Exode 7-12', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('10', true, 1), ('7', false, 2), ('12', false, 3), ('3', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'nouveau-testament'),
    'mcq', 2, 'Qui est devenu aveugle sur le chemin de Damas avant de devenir apôtre ?',
    'Saul de Tarse, persécuteur des chrétiens, rencontra Jésus ressuscité et devint l''apôtre Paul.',
    'Actes 9', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Paul', true, 1), ('Étienne', false, 2), ('Barnabas', false, 3), ('Silas', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 2, 'Quel prophète a été enlevé au ciel dans un char de feu ?',
    'Élie fut enlevé au ciel dans un tourbillon, avec un char et des chevaux de feu, sous les yeux d''Élisée.',
    '2 Rois 2:11', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Élie', true, 1), ('Élisée', false, 2), ('Ézéchiel', false, 3), ('Isaïe', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'nouveau-testament'),
    'mcq', 2, 'Combien de temps Jésus a-t-il jeûné dans le désert avant d''être tenté par le diable ?',
    'Jésus jeûna quarante jours et quarante nuits avant les trois tentations.',
    'Matthieu 4:1-2', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('40 jours', true, 1), ('7 jours', false, 2), ('3 jours', false, 3), ('12 jours', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'nouveau-testament'),
    'mcq', 2, 'Qui fut le premier martyr chrétien, lapidé pour sa foi ?',
    'Étienne, l''un des sept premiers diacres, fut lapidé après avoir témoigné devant le Sanhédrin.',
    'Actes 7', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Étienne', true, 1), ('Jacques', false, 2), ('Paul', false, 3), ('Pierre', false, 4)) AS v(choice_text, is_correct, display_order);

-- ----------------------------------------------------------------------------
-- QUIZ BIBLIQUE — difficulté 3
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 3, 'Quel est le nom du serviteur d''Abraham envoyé chercher une épouse pour Isaac ?',
    'Éliézer de Damas, serviteur de confiance d''Abraham, ramena Rebecca pour Isaac.',
    'Genèse 24', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Éliézer', true, 1), ('Laban', false, 2), ('Nachor', false, 3), ('Lot', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'ancien-testament'),
    'mcq', 3, 'Combien d''années les Hébreux ont-ils erré dans le désert avant d''entrer en Terre promise ?',
    'À cause de leur incrédulité, la génération sortie d''Égypte erra quarante ans dans le désert.',
    'Nombres 14:33-34', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('40 ans', true, 1), ('70 ans', false, 2), ('12 ans', false, 3), ('100 ans', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'ancien-testament'),
    'mcq', 3, 'Quel roi de Babylone vit l''inscription mystérieuse « Mené, Mené, Tekel, Parsin » sur le mur ?',
    'Daniel interpréta cette inscription pour Belshatsar comme l''annonce de la chute de son royaume.',
    'Daniel 5', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Belshatsar', true, 1), ('Nabuchodonosor', false, 2), ('Cyrus', false, 3), ('Darius', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'ancien-testament'),
    'mcq', 3, 'Quel est le nom du mont où Abraham fut appelé à sacrifier Isaac ?',
    'Dieu demanda à Abraham d''offrir Isaac sur une montagne du pays de Morija.',
    'Genèse 22:2', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Morija', true, 1), ('Sinaï', false, 2), ('Horeb', false, 3), ('Ararat', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'nouveau-testament'),
    'mcq', 3, 'Combien de temps s''est écoulé entre la résurrection de Jésus et son ascension, selon les Actes ?',
    'Jésus apparut aux apôtres pendant quarante jours avant de monter au ciel.',
    'Actes 1:3', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('40 jours', true, 1), ('3 jours', false, 2), ('50 jours', false, 3), ('7 jours', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'nouveau-testament'),
    'mcq', 3, 'Quel est le nom du tribunal juif devant lequel Jésus a comparu à Jérusalem ?',
    'Le Sanhédrin, haute cour religieuse juive, jugea Jésus avant de le livrer à Pilate.',
    'Matthieu 26:59', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Le Sanhédrin', true, 1), ('Le Prétoire', false, 2), ('La Synagogue', false, 3), ('Le Conseil des Anciens', false, 4)) AS v(choice_text, is_correct, display_order);

-- ----------------------------------------------------------------------------
-- COMPLÈTE LE VERSET — difficulté 2
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 2,
    'Complète le verset : « L''Éternel est ma ______ et mon salut : de qui aurais-je crainte ? »',
    'Le psaume 27 exprime la confiance du croyant face au danger.',
    'Psaume 27:1', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('lumière', true, 1), ('force', false, 2), ('joie', false, 3), ('gloire', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 2,
    'Complète le verset : « Ainsi parle l''Éternel : Que le sage ne se glorifie pas de sa ______. »',
    'Jérémie oppose la vraie gloire, qui est de connaître Dieu, à la sagesse humaine.',
    'Jérémie 9:23', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('sagesse', true, 1), ('richesse', false, 2), ('force', false, 3), ('beauté', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 2,
    'Complète le verset : « Heureux l''homme qui ne marche pas selon le conseil des ______. »',
    'Le psaume 1 décrit le bonheur de celui qui évite la compagnie des méchants.',
    'Psaume 1:1', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('méchants', true, 1), ('impies', false, 2), ('pécheurs', false, 3), ('hommes', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 2,
    'Complète le verset : « Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des ______ et des supplications. »',
    'Paul invite les Philippiens à remplacer l''inquiétude par la prière.',
    'Philippiens 4:6', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('prières', true, 1), ('jeûnes', false, 2), ('larmes', false, 3), ('sacrifices', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 2,
    'Complète le verset : « La foi est une ferme assurance des choses qu''on ______, une démonstration de celles qu''on ne voit pas. »',
    'Hébreux 11 ouvre le grand chapitre de la foi par cette définition.',
    'Hébreux 11:1', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('espère', true, 1), ('désire', false, 2), ('ignore', false, 3), ('cherche', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 2,
    'Complète le verset : « Que votre ______ soit sans hypocrisie. »',
    'Paul exhorte les Romains à un amour sincère et véritable.',
    'Romains 12:9', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('amour', true, 1), ('foi', false, 2), ('parole', false, 3), ('prière', false, 4)) AS v(choice_text, is_correct, display_order);

-- ----------------------------------------------------------------------------
-- COMPLÈTE LE VERSET — difficulté 3
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 3,
    'Complète le verset : « Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était ______. »',
    'Le prologue de Jean affirme la divinité du Verbe dès le premier verset de son évangile.',
    'Jean 1:1', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Dieu', true, 1), ('lumière', false, 2), ('vie', false, 3), ('esprit', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 3,
    'Complète le verset : « Car l''Éternel donne la sagesse ; de sa bouche sortent la connaissance et l''______. »',
    'Les Proverbes présentent Dieu comme la source de toute sagesse.',
    'Proverbes 2:6', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('intelligence', true, 1), ('abondance', false, 2), ('éternité', false, 3), ('alliance', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 3,
    'Complète le verset : « Ce que l''œil n''a pas vu, ce que l''oreille n''a pas entendu... Dieu l''a préparé pour ceux qui l''______. »',
    'Paul décrit ce que Dieu réserve à ceux qui l''aiment, au-delà de toute compréhension humaine.',
    '1 Corinthiens 2:9', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('aiment', true, 1), ('craignent', false, 2), ('servent', false, 3), ('cherchent', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 3,
    'Complète le verset : « Il y a un temps pour tout, un temps pour toute chose sous les ______. »',
    'L''Ecclésiaste ouvre sa célèbre méditation sur les saisons de la vie.',
    'Ecclésiaste 3:1', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('cieux', true, 1), ('étoiles', false, 2), ('hommes', false, 3), ('nations', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 3,
    'Complète le verset : « Ma grâce te suffit, car ma puissance s''accomplit dans la ______. »',
    'Paul reçoit cette réponse de Dieu au sujet de son « écharde dans la chair ».',
    '2 Corinthiens 12:9', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('faiblesse', true, 1), ('souffrance', false, 2), ('patience', false, 3), ('prière', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 3,
    'Complète le verset : « Que la paix de Dieu, qui surpasse toute ______, garde vos cœurs et vos pensées en Jésus-Christ. »',
    'Paul conclut son exhortation aux Philippiens par cette promesse de paix.',
    'Philippiens 4:7', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('intelligence', true, 1), ('connaissance', false, 2), ('sagesse', false, 3), ('prière', false, 4)) AS v(choice_text, is_correct, display_order);

-- ----------------------------------------------------------------------------
-- QUI SUIS-JE ? — difficulté 2
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 2,
    'J''étais une prostituée de Jéricho, mais j''ai caché les espions israélites et j''ai été sauvée avec ma famille. Je suis même citée dans la généalogie de Jésus. Qui suis-je ?',
    'Rahab cacha les espions envoyés par Josué et fut épargnée lors de la chute de Jéricho.',
    'Josué 2 ; Matthieu 1:5', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Rahab', true, 1), ('Ruth', false, 2), ('Esther', false, 3), ('Tamar', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 2,
    'Je suis une Moabite restée fidèle à ma belle-mère après la mort de mon mari. Je suis devenue l''arrière-grand-mère du roi David. Qui suis-je ?',
    'Ruth quitta Moab pour suivre Naomi et épousa ensuite Boaz.',
    'Livre de Ruth', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Ruth', true, 1), ('Rahab', false, 2), ('Orpa', false, 3), ('Naomi', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 2,
    'J''ai été le premier roi d''Israël, choisi par le prophète Samuel, mais j''ai perdu la faveur de Dieu par désobéissance. Qui suis-je ?',
    'Saül fut le premier roi d''Israël, remplacé plus tard par David après avoir désobéi à Dieu.',
    '1 Samuel 9-15', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Saül', true, 1), ('David', false, 2), ('Salomon', false, 3), ('Roboam', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 2,
    'Je suis un prêtre et scribe qui a conduit la reconstruction spirituelle du peuple après l''exil, en lisant la loi de Moïse au peuple rassemblé. Qui suis-je ?',
    'Esdras enseigna et fit lire la loi au peuple après le retour d''exil à Babylone.',
    'Esdras 7 ; Néhémie 8', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Esdras', true, 1), ('Néhémie', false, 2), ('Zorobabel', false, 3), ('Aggée', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 2,
    'J''ai reconstruit les murailles de Jérusalem en 52 jours malgré l''opposition de mes ennemis. Qui suis-je ?',
    'Néhémie, échanson du roi de Perse, organisa la reconstruction des murailles de Jérusalem.',
    'Néhémie 6:15', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Néhémie', true, 1), ('Esdras', false, 2), ('Zorobabel', false, 3), ('Malachie', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 2,
    'Je suis un collecteur d''impôts monté dans un arbre pour voir Jésus passer, qui m''a ensuite invité chez moi. Qui suis-je ?',
    'Zachée, chef des péagers de Jéricho, grimpa sur un sycomore pour voir Jésus.',
    'Luc 19:1-10', 20
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Zachée', true, 1), ('Matthieu', false, 2), ('Lévi', false, 3), ('Barthélemy', false, 4)) AS v(choice_text, is_correct, display_order);

-- ----------------------------------------------------------------------------
-- QUI SUIS-JE ? — difficulté 3
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 3,
    'Je suis un juge d''Israël qui a vaincu une immense armée madianite avec seulement 300 hommes. Qui suis-je ?',
    'Gédéon défit l''armée madianite avec 300 hommes armés de trompettes et de torches.',
    'Juges 7', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Gédéon', true, 1), ('Samson', false, 2), ('Barak', false, 3), ('Jephté', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 3,
    'Je suis la première femme prophétesse et juge d''Israël mentionnée dans la Bible, et j''ai conduit le peuple à la victoire avec Barak. Qui suis-je ?',
    'Débora jugea Israël et encouragea Barak à combattre l''armée de Sisera.',
    'Juges 4-5', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Débora', true, 1), ('Yaël', false, 2), ('Miriam', false, 3), ('Houlda', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 3,
    'J''étais gouverneur romain de Judée et j''ai condamné Jésus à la crucifixion malgré mes doutes sur sa culpabilité. Qui suis-je ?',
    'Ponce Pilate céda à la pression de la foule et livra Jésus à la crucifixion.',
    'Matthieu 27:24-26', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Ponce Pilate', true, 1), ('Hérode Antipas', false, 2), ('Caïphe', false, 3), ('Félix', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 3,
    'Je suis un pharisien devenu apôtre après une rencontre avec Jésus ressuscité sur le chemin de Damas, et j''ai écrit la majorité des lettres du Nouveau Testament. Qui suis-je ?',
    'Paul (Saul de Tarse) devint le grand apôtre des nations après sa conversion.',
    'Actes 9 ; Galates 1', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Paul', true, 1), ('Barnabas', false, 2), ('Apollos', false, 3), ('Silas', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 3,
    'Je suis le roi d''Israël dont le règne a marqué l''apogée du royaume, et j''ai construit le premier Temple de Jérusalem. Qui suis-je ?',
    'Salomon, fils de David, bâtit le Temple de Jérusalem durant l''âge d''or du royaume uni.',
    '1 Rois 6', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Salomon', true, 1), ('David', false, 2), ('Ézéchias', false, 3), ('Josias', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 3,
    'Je suis la femme du roi Achab, j''ai fait tuer les prophètes de l''Éternel et j''ai persécuté Élie. Qui suis-je ?',
    'Jézabel, reine phénicienne, imposa le culte de Baal et persécuta les prophètes de Dieu.',
    '1 Rois 18-19', 25
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Jézabel', true, 1), ('Athalie', false, 2), ('Hérodiade', false, 3), ('Dalila', false, 4)) AS v(choice_text, is_correct, display_order);
