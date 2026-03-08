import PogObject from "PogData";

// --- CONFIGURATION ---
const prefix = "§b[Solus] ";
const GITHUB_BASE = "https://raw.githubusercontent.com/SolusFR/SolusClient/refs/heads/main/SolusFriend/";

// Sauvegarde Locale (Amis)
const data = new PogObject("SimpleFriend", {
    friends: [],
    pvpEnabled: false
}, "data.json");

// Sauvegarde Locale (Cheaters)
const cheatersData = new PogObject("SolusCheaters", {
    list: {} // Format: { "uuid_ou_nom": {name: "xxx", reason: "xxx", premium: true} }
}, "cheaters.json");

// Listes Cloud
let cloudFriends = [];
let cloudInvincibles = [];
let cloudCheaters = {};
let lastUpdate = 0;

// --- 1. GESTION DU CLOUD ---
function fetchList(filename, time) {
    try {
        let content = FileLib.getUrlContent(GITHUB_BASE + filename + time);
        if (!content) return [];
        return content.split("\n").map(s => s.replace(/[^a-zA-Z0-9_]/g, "").trim()).filter(s => s.length >= 3);
    } catch (e) { return []; }
}

function updateCloud(silent = true) {
    new Thread(() => {
        if (!silent) ChatLib.chat(prefix + "§7Synchronisation Cloud...");
        let t = "?t=" + Date.now();
        
        cloudFriends = fetchList("default_friend.txt", t);
        cloudInvincibles = fetchList("invincible.txt", t);
        
        // Fetch Cheater Cloud
        try {
            let cJson = FileLib.getUrlContent(GITHUB_BASE + "cheater.json" + t);
            if (cJson) cloudCheaters = JSON.parse(cJson);
        } catch(e) {}
        
        lastUpdate = Date.now();
        if (!silent) ChatLib.chat(prefix + "§aCloud à jour !");
    }).start();
}

register("step", () => {
    if (Date.now() - lastUpdate > 60000) updateCloud(true);
}).setDelay(5);

updateCloud(true);

// --- 2. LOGIQUE DE DÉTECTION ---
function getStatus(name) {
    if (!name) return "NONE";
    let n = ChatLib.removeFormatting(name).toLowerCase().trim();

    // 1. Priorité Cheater (Local ou Cloud)
    let isSuspect = false;
    // Check Cloud
    for (let id in cloudCheaters) {
        if (cloudCheaters[id].name.toLowerCase() === n) isSuspect = true;
    }
    // Check Local
    for (let id in cheatersData.list) {
        if (cheatersData.list[id].name.toLowerCase() === n) isSuspect = true;
    }
    if (isSuspect) return "CHEATER";

    // 2. Invincibles / Amis
    if (cloudInvincibles.some(x => x.toLowerCase() === n)) return "INVINCIBLE";
    if (data.friends.some(x => x.toLowerCase() === n) || cloudFriends.some(x => x.toLowerCase() === n)) return "FRIEND";
    
    return "NONE";
}

// Récupère les infos d'un cheater pour l'affichage
function getCheaterInfo(name) {
    let n = name.toLowerCase().trim();
    // Priorité local pour les raisons
    for (let id in cheatersData.list) {
        if (cheatersData.list[id].name.toLowerCase() === n) return cheatersData.list[id];
    }
    for (let id in cloudCheaters) {
        if (cloudCheaters[id].name.toLowerCase() === n) return cloudCheaters[id];
    }
    return null;
}

// --- 3. COMMANDES CHEATER (/lc) ---
register("command", (...args) => {
    if (!args || args.length === 0) {
        ChatLib.chat("§c§lSolus Cheater Tracker");
        ChatLib.chat("§c/lc add <pseudo> [raison] §7- Marquer un cheater");
        ChatLib.chat("§c/lc remove <pseudo>        §7- Retirer un cheater");
        return;
    }

    let action = args[0].toLowerCase();
    let name = args[1];
    let reason = args.slice(2).join(" ") || "Aucune raison";

    if (action === "add" && name) {
        ChatLib.chat(prefix + "§7Vérification du compte Mojang...");
        new Thread(() => {
            try {
                // Appel API Mojang pour l'UUID
                let raw = FileLib.getUrlContent("https://api.mojang.com/users/profiles/minecraft/" + name);
                let isPremium = false;
                let id = name; // Defaut pour les cracks

                if (raw) {
                    let json = JSON.parse(raw);
                    if (json.id) {
                        id = json.id; // On stocke l'UUID réel
                        name = json.name; // On update le pseudo correct (Majuscules)
                        isPremium = true;
                    }
                }

                cheatersData.list[id] = {
                    name: name,
                    reason: reason,
                    premium: isPremium,
                    date: new Date().toLocaleDateString()
                };
                cheatersData.save();
                ChatLib.chat(prefix + "§4§l" + name + " §cajouté à la liste noire ! (§f" + (isPremium ? "Premium" : "Crack") + "§c)");
            } catch(e) { ChatLib.chat(prefix + "§cErreur API."); }
        }).start();
    }
    else if (action === "remove" && name) {
        let found = false;
        for (let id in cheatersData.list) {
            if (cheatersData.list[id].name.toLowerCase() === name.toLowerCase()) {
                delete cheatersData.list[id];
                found = true;
            }
        }
        if (found) {
            cheatersData.save();
            ChatLib.chat(prefix + "§aJoueur " + name + " retiré des cheaters.");
        } else ChatLib.chat(prefix + "§cNon trouvé en local.");
    }
}).setName("lc");

// --- 4. COMMANDES AMIS (/lf) ---
register("command", (...args) => {
    if (!args || args.length === 0) {
        ChatLib.chat("§2/lf add/remove <pseudo> | /lf pvp | /lf force");
        return;
    }
    let action = args[0].toLowerCase();
    let pseudo = args[1];

    if (action === "add" && pseudo) {
        if (!data.friends.includes(pseudo)) {
            data.friends.push(pseudo); data.save();
            ChatLib.chat(prefix + "§a" + pseudo + " ajouté.");
        }
    }
    else if (action === "remove" && pseudo) {
        data.friends = data.friends.filter(x => x.toLowerCase() !== pseudo.toLowerCase());
        data.save();
        ChatLib.chat(prefix + "§c" + pseudo + " retiré.");
    }
    else if (action === "pvp") {
        data.pvpEnabled = !data.pvpEnabled; data.save();
        ChatLib.chat(prefix + "PvP Ami : " + (data.pvpEnabled ? "§cON" : "§aOFF"));
    }
    else if (action === "force") updateCloud(false);
}).setName("localfriend").setAliases("lf");

// --- 5. GAMEPLAY & VISUELS ---

// Anti-Hit
register("attackEntity", (entity, event) => {
    if (entity.getClassName() !== "EntityOtherPlayerMP") return;
    let st = getStatus(entity.getName());
    if (st === "INVINCIBLE" || (st === "FRIEND" && !data.pvpEnabled)) {
        cancel(event);
        World.playSound("random.anvil_land", 0.5, 0.5);
    }
});

// ESP 3D
register("renderWorld", () => {
    World.getAllPlayers().forEach(p => {
        if (p.getName() === Player.getName()) return;
        let st = getStatus(p.getName());
        if (st === "NONE") return;

        let dist = Math.round(Player.asPlayerMP().distanceTo(p));
        if (dist > 60) return;

        let x = p.getRenderX();
        let y = p.getRenderY() + p.getHeight() + 0.5;
        let z = p.getRenderZ();
        
        if (st === "CHEATER") {
            let info = getCheaterInfo(p.getName());
            let type = info.premium ? "§b[P]" : "§7[C]";
            // Fait clignoter le tag "CHEATER"
            let tag = (Date.now() % 1000 < 500) ? "§4§l⚠ CHEATER ⚠" : "§c§l⚠ CHEATER ⚠";
            Tessellator.drawString(tag + " " + type, x, y + 0.3, z, 0, true, 0.04, false);
            Tessellator.drawString("§f" + info.reason, x, y, z, 0, true, 0.02, false);
        } 
        else if (st === "INVINCIBLE") {
            Tessellator.drawString("§d§l★ INVINCIBLE ★", x, y, z, 0, true, 0.04, false);
        } 
        else if (st === "FRIEND") {
            Tessellator.drawString("§a★ AMI ★ §7(" + dist + "m)", x, y, z, 0, true, 0.03, false);
        }
    });
});

// Tablist
register("tick", () => {
    if (!World.isLoaded()) return;
    try {
        let sb = World.getWorld().func_96441_U();
        let tGod = sb.func_96508_e("0_GOD") || sb.func_96527_f("0_GOD"); tGod.func_96666_b("§d§lGOD §d");
        let tFri = sb.func_96508_e("1_FRI") || sb.func_96527_f("1_FRI"); tFri.func_96666_b("§a§lAMI §a");
        let tSus = sb.func_96508_e("9_SUS") || sb.func_96527_f("9_SUS"); tSus.func_96666_b("§4§l☣ §c");

        let netHandler = Client.getMinecraft().func_147114_u();
        let playerMap = netHandler.func_175106_d(); 

        for (let info of playerMap) {
            let name = info.func_178845_a().getName();
            let st = getStatus(name);
            if (st === "NONE") continue;

            let teamName = (st === "INVINCIBLE" ? "0_GOD" : (st === "FRIEND" ? "1_FRI" : "9_SUS"));
            let teamObj = (st === "INVINCIBLE" ? tGod : (st === "FRIEND" ? tFri : tSus));
            let col = (st === "INVINCIBLE" ? "§d" : (st === "FRIEND" ? "§a" : "§c"));

            if (!teamObj.func_96665_g().contains(name)) sb.func_151392_a(name, teamName);
            
            let dn = info.func_178854_k();
            if (dn == null || dn.func_150254_d().indexOf(col) == -1) {
                 let CCT = Java.type("net.minecraft.util.ChatComponentText");
                 info.func_178859_a(new CCT(col + name));
            }
        }
    } catch(e) {}
});
