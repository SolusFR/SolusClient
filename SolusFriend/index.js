// ==========================================
// 🛡️ SOLUS FRIEND - SYSTEME PVP & LISTES EN LIGNE
// ==========================================

const MODULE_NAME = "SolusFriend";
const URL_DEFAULT_FRIENDS = "https://raw.githubusercontent.com/SolusFR/SolusClient/refs/heads/main/SolusFriend/default-friend.txt";
const URL_INVINCIBLE = "https://raw.githubusercontent.com/SolusFR/SolusClient/refs/heads/main/SolusFriend/invincible.txt";

// Variables
let localFriends = [];      // Amis ajoutés par toi (/sfriend add)
let onlineFriends = [];     // Amis par défaut (depuis le site)
let invinciblePlayers = []; // Joueurs intouchables (depuis le site)

let isFriendPvpEnabled = false; // Par défaut, on ne peut pas taper ses amis

// ==========================================
// 🌐 CHARGEMENT DES DONNÉES
// ==========================================

// 1. Chargement Local
try {
    let saved = FileLib.read(MODULE_NAME, "friends.json");
    if (saved) localFriends = JSON.parse(saved);
} catch (e) {
    // Fichier vide ou inexistant
}

// 2. Chargement en Ligne (Thread séparé pour ne pas freeze le jeu)
register("step", () => {
    new Thread(() => {
        try {
            // Récupère la liste des amis par défaut
            let rawDefault = FileLib.getUrlContent(URL_DEFAULT_FRIENDS);
            if (rawDefault) {
                onlineFriends = rawDefault.split("\n")
                    .map(line => line.trim())
                    .filter(line => line.length > 2); // Filtre les lignes vides
            }

            // Récupère la liste des invincibles
            let rawInvincible = FileLib.getUrlContent(URL_INVINCIBLE);
            if (rawInvincible) {
                invinciblePlayers = rawInvincible.split("\n")
                    .map(line => line.trim())
                    .filter(line => line.length > 2);
            }
        } catch (e) {
            print("[SolusFriend] Erreur de récupération des listes en ligne : " + e);
        }
    }).start();
}).setDelay(60); // Vérifie/Met à jour toutes les minutes

// Sauvegarde Locale
function saveLocal() {
    FileLib.write(MODULE_NAME, "friends.json", JSON.stringify(localFriends));
}

// ==========================================
// ⚔️ LOGIQUE PVP & PROTECTION
// ==========================================

// Vérifie si un joueur est ami (Local OU En ligne)
function isPlayerFriend(name) {
    let lower = name.toLowerCase();
    return localFriends.some(f => f.toLowerCase() === lower) || 
           onlineFriends.some(f => f.toLowerCase() === lower);
}

// Vérifie si un joueur est invincible
function isPlayerInvincible(name) {
    let lower = name.toLowerCase();
    return invinciblePlayers.some(f => f.toLowerCase() === lower);
}

// Intercepte les coups (Clic Gauche)
register("attackEntity", (event) => {
    // On vérifie que la cible est bien un joueur
    if (!event.target || !event.target.getName()) return;
    
    let targetName = event.target.getName();

    // 1. PROTECTION ABSOLUE (Invincible)
    // Même si le FriendPvP est activé, on ne touche pas ces joueurs.
    if (isPlayerInvincible(targetName)) {
        ChatLib.actionbar("&4&l🛡️ PROTECTION ADMIN ACTIVE &7(Sur " + targetName + ")");
        cancel(event);
        return;
    }

    // 2. PROTECTION D'AMIS CLASSIQUE
    // Si le PvP Ami est DÉSACTIVÉ et que le joueur est un ami...
    if (!isFriendPvpEnabled && isPlayerFriend(targetName)) {
        ChatLib.actionbar("&a&lTu ne peux pas taper ton ami ! &7(" + targetName + ")");
        cancel(event);
        return;
    }
});

// ==========================================
// 🎮 COMMANDES
// ==========================================

// Commande: /friendpvp (Toggle)
register("command", () => {
    isFriendPvpEnabled = !isFriendPvpEnabled;
    if (isFriendPvpEnabled) {
        ChatLib.chat("&8[&bSolus&8] &cPvP Ami ACTIVÉ ! &7(Tu peux taper tes amis, sauf les admins)");
        World.playSound("random.click", 1, 2);
    } else {
        ChatLib.chat("&8[&bSolus&8] &aPvP Ami DÉSACTIVÉ ! &7(Tes amis sont protégés)");
        World.playSound("random.orb", 1, 1);
    }
}).setName("friendpvp");

// Commande: /sfriend
register("command", (...args) => {
    if (!args || args.length === 0) {
        ChatLib.chat("&8&m---------------------------------------");
        ChatLib.chat("&b&l⭐ Solus Friends Manager ⭐");
        ChatLib.chat("&3/friendpvp &7- Activer/Désactiver le PvP ami");
        ChatLib.chat("&3/sfriend add <joueur> &7- Ajouter un ami local");
        ChatLib.chat("&3/sfriend remove <joueur> &7- Retirer un ami local");
        ChatLib.chat("&3/sfriend list &7- Voir tous les amis");
        ChatLib.chat("&8&m---------------------------------------");
        return;
    }

    let action = args[0].toLowerCase();

    if (action === "add") {
        if (args.length < 2) return ChatLib.chat("&c[Solus] Précise un pseudo.");
        let p = args[1];

        // Vérification
        if (isPlayerFriend(p)) {
            // Est-ce un ami par défaut ?
            if (onlineFriends.some(f => f.toLowerCase() === p.toLowerCase())) {
                ChatLib.chat("&c[Solus] " + p + " est déjà un ami par défaut (Impossible à modifier).");
            } else {
                ChatLib.chat("&c[Solus] " + p + " est déjà dans ta liste locale.");
            }
            return;
        }

        localFriends.push(p);
        saveLocal();
        ChatLib.chat("&a[Solus] &b" + p + " &aajouté à tes amis locaux !");
    } 
    else if (action === "remove") {
        if (args.length < 2) return ChatLib.chat("&c[Solus] Précise un pseudo.");
        let p = args[1].toLowerCase();
        
        let idx = localFriends.findIndex(f => f.toLowerCase() === p);
        if (idx !== -1) {
            localFriends.splice(idx, 1);
            saveLocal();
            ChatLib.chat("&c[Solus] &b" + args[1] + " &cretiré de tes amis locaux.");
        } else {
            if (onlineFriends.some(f => f.toLowerCase() === p)) {
                ChatLib.chat("&c[Solus] Tu ne peux pas retirer " + args[1] + " (Ami par défaut serveur).");
            } else {
                ChatLib.chat("&c[Solus] Ce joueur n'est pas dans ta liste.");
            }
        }
    } 
    else if (action === "list") {
        ChatLib.chat("&8&m---------------------------------------");
        ChatLib.chat("&b⭐ Liste Complète des Amis ⭐");
        
        // 1. Amis par défaut (Online)
        if (onlineFriends.length > 0) {
            ChatLib.chat("&6--- Amis Serveur (" + onlineFriends.length + ") ---");
            onlineFriends.forEach(f => {
                let prefix = isPlayerInvincible(f) ? "&c[INVINCIBLE] " : "";
                ChatLib.chat("&e✦ " + prefix + "&e" + f + " &7(Par défaut)");
            });
        }

        // 2. Amis Locaux
        if (localFriends.length > 0) {
            ChatLib.chat("&b--- Amis Locaux (" + localFriends.length + ") ---");
            localFriends.forEach(f => {
                 new Message(
                    "&3- &b" + f + " ",
                    new TextComponent("&8[&cRetirer&8]")
                        .setClick("run_command", "/sfriend remove " + f)
                        .setHover("show_text", "&cClique pour retirer " + f)
                ).chat();
            });
        } else {
            ChatLib.chat("&7Aucun ami local ajouté.");
        }
        
        ChatLib.chat("&7État du PvP Ami : " + (isFriendPvpEnabled ? "&cACTIVÉ" : "&aDÉSACTIVÉ"));
        ChatLib.chat("&8&m---------------------------------------");
    }
}).setName("sfriend").setTabCompletions((args) => {
    // Tab Complete basique
    if (args.length === 1) return ["add", "remove", "list"].filter(a => a.startsWith(args[0].toLowerCase()));
    
    // Tab Complete Joueurs
    if (args.length === 2) {
        let players = [];
        try { World.getAllPlayers().forEach(p => players.push(p.getName())); } catch(e){}
        return [...new Set(players)].filter(p => p.toLowerCase().startsWith(args[1].toLowerCase()));
    }
    return [];
});
