// ==========================================
// 💎 SOLUS FRIEND - STANDALONE MODULE
// ==========================================
// Ce module gère les amis, le highlight chat, les sons
// et se met à jour tout seul comme un grand.
// ==========================================

const MODULE_NAME = "SolusFriend";
const FILE_NAME = "index.js";

// ⚠️ REMPLACE CE LIEN PAR LE LIEN "RAW" DE TON FICHIER SUR GITHUB/GIST
// Exemple: "https://raw.githubusercontent.com/TonPseudo/TonRepo/main/SolusFriend/index.js"
const UPDATE_URL = "TON_LIEN_RAW_GITHUB_ICI"; 

const COULEUR_AMI = "§b§l"; // Cyan Gras
const JOUER_SON = true;     // Son "Ding"

let friends = [];

// ==========================================
// 🔄 SYSTÈME D'AUTO-UPDATE
// ==========================================
function normalize(str) {
    return str ? str.replace(/\r\n/g, "\n").trim() : "";
}

register("step", () => {
    new Thread(() => {
        try {
            // On ne vérifie pas si l'URL est celle par défaut pour éviter les erreurs
            if (UPDATE_URL === "TON_LIEN_RAW_GITHUB_ICI") return;

            // Ajout d'un timestamp pour éviter le cache (?t=123456)
            let remoteContent = FileLib.getUrlContent(UPDATE_URL + "?t=" + Date.now());
            
            if (!remoteContent || remoteContent.length < 10) return;

            let localContent = FileLib.read(MODULE_NAME, FILE_NAME);

            if (normalize(remoteContent) !== normalize(localContent)) {
                ChatLib.chat("&b[SolusFriend] &aUne mise à jour a été détectée !");
                ChatLib.chat("&b[SolusFriend] &7Téléchargement et installation...");
                
                FileLib.write(MODULE_NAME, FILE_NAME, remoteContent);
                
                Thread.sleep(1000);
                ChatLib.chat("&b[SolusFriend] &aMise à jour terminée ! Rechargement...");
                ChatLib.command("ct load", true);
            }
        } catch (e) {
            print("[SolusFriend] Erreur Update: " + e);
        }
    }).start();
}).setDelay(300); // Vérifie toutes les 5 minutes (300 secondes)


// ==========================================
// 💾 SAUVEGARDE & CHARGEMENT
// ==========================================
try {
    let saved = FileLib.read(MODULE_NAME, "friends.json");
    if (saved) friends = JSON.parse(saved);
} catch (e) {}

function saveFriends() {
    FileLib.write(MODULE_NAME, "friends.json", JSON.stringify(friends));
}

function getOnlinePlayers() {
    let players = [];
    try {
        if (World.isLoaded()) {
            World.getAllPlayers().forEach(p => players.push(p.getName()));
        }
    } catch (e) {}
    return [...new Set(players)];
}

// ==========================================
// 🎮 LOGIQUE DES COMMANDES
// ==========================================
function handleFriendCommand(args) {
    if (!args || args.length === 0) {
        ChatLib.chat("&8&m---------------------------------------");
        ChatLib.chat("&b&l⭐ Solus Friends (Standalone) ⭐");
        ChatLib.chat("&3/sfriend add <pseudo> &7- Ajouter");
        ChatLib.chat("&3/sfriend remove <pseudo> &7- Retirer");
        ChatLib.chat("&3/sfriend list &7- Liste");
        ChatLib.chat("&8&m---------------------------------------");
        return;
    }

    let action = args[0].toLowerCase();

    if (action === "add") {
        if (args.length < 2) return ChatLib.chat("&c[Solus] Erreur: Pseudo manquant.");
        let p = args[1];
        if (!friends.some(f => f.toLowerCase() === p.toLowerCase())) {
            friends.push(p);
            saveFriends();
            ChatLib.chat("&a[Solus] Ami &b" + p + " &aajouté !");
        } else {
            ChatLib.chat("&c[Solus] " + p + " est déjà ton ami.");
        }
    } 
    else if (action === "remove") {
        if (args.length < 2) return ChatLib.chat("&c[Solus] Erreur: Pseudo manquant.");
        let idx = friends.findIndex(f => f.toLowerCase() === args[1].toLowerCase());
        if (idx !== -1) {
            let removed = friends[idx];
            friends.splice(idx, 1);
            saveFriends();
            ChatLib.chat("&c[Solus] Ami &b" + removed + " &cretiré.");
        } else {
            ChatLib.chat("&c[Solus] Ce joueur n'est pas dans ta liste.");
        }
    } 
    else if (action === "list") {
        ChatLib.chat("&b⭐ Tes Amis (" + friends.length + ") ⭐");
        if (friends.length === 0) ChatLib.chat("&7Aucun ami enregistré.");
        friends.forEach(f => {
            new Message(
                "&3- &b" + f + " ",
                new TextComponent("&8[&cRetirer&8]")
                    .setClick("run_command", "/sfriend remove " + f)
                    .setHover("show_text", "&cClique pour retirer " + f)
            ).chat();
        });
    }
}

// 1. Commande principale /sfriend
register("command", (...args) => {
    handleFriendCommand(args);
}).setName("sfriend").setTabCompletions((args) => {
    if (!args || args.length === 0) return [];
    
    // Suggestion action
    if (args.length === 1) {
        return ["add", "remove", "list"].filter(a => a.startsWith(args[0].toLowerCase()));
    }
    
    // Suggestion joueurs
    if (args.length === 2) {
        let action = args[0].toLowerCase();
        let current = args[1].toLowerCase();
        
        if (action === "add") {
            // Propose les joueurs connectés qui ne sont PAS amis
            return getOnlinePlayers().filter(p => 
                p.toLowerCase().startsWith(current) && !friends.some(f => f.toLowerCase() === p.toLowerCase())
            );
        }
        if (action === "remove") {
            // Propose uniquement les amis actuels
            return friends.filter(f => f.toLowerCase().startsWith(current));
        }
    }
    return [];
});

// 2. Interception de /solus friend (Hijack)
register("messageSent", (msg, event) => {
    if (msg.toLowerCase().startsWith("/solus friend")) {
        cancel(event); // Bloque l'envoi au serveur/module cassé
        handleFriendCommand(msg.split(" ").slice(2));
    }
});

// ==========================================
// 💬 INTERCEPTION DU TCHAT (Highlight)
// ==========================================
register("chat", (event) => {
    if (friends.length === 0) return;
    
    let unformatted = ChatLib.getChatMessage(event, false);
    let formatted = ChatLib.getChatMessage(event, true);
    let changed = false;

    friends.forEach(f => {
        // Regex stricte (mot entier) insensible à la casse
        let regex = new RegExp("\\b" + f + "\\b", "i");
        
        if (regex.test(unformatted)) {
            changed = true;
            // Remplacement visuel
            let replaceRegex = new RegExp("(" + f + ")", "ig");
            formatted = formatted.replace(replaceRegex, COULEUR_AMI + "$1§r");
        }
    });

    if (changed) {
        cancel(event);
        ChatLib.chat(formatted);
        if (JOUER_SON) World.playSound("random.orb", 1, 1);
    }
});
