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
    list: {} // Format: { "identifiant": {name: "xxx", reason: "xxx", premium: true} }
}, "cheaters.json");

// Listes Cloud
let cloudFriends = [];
let cloudInvincibles = [];
let cloudCheaters = {};
let lastUpdate = 0;

// Variables Système
const gui = new Gui();
let guiInput = "";
let actionBarMsg = "";
let actionBarTimer = 0;

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
        
        try {
            let cJson = FileLib.getUrlContent(GITHUB_BASE + "cheater.json" + t);
            if (cJson) {
                let parsed = JSON.parse(cJson);
                cloudCheaters = parsed;
            }
        } catch(e) {
            cloudCheaters = {};
        }
        
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

    // Check Cloud Cheaters
    for (let id in cloudCheaters) {
        if (cloudCheaters[id].name.toLowerCase() === n) return "CHEATER";
    }
    // Check Local Cheaters
    for (let id in cheatersData.list) {
        if (cheatersData.list[id].name.toLowerCase() === n) return "CHEATER";
    }

    if (cloudInvincibles.some(x => x.toLowerCase() === n)) return "INVINCIBLE";
    if (data.friends.some(x => x.toLowerCase() === n) || cloudFriends.some(x => x.toLowerCase() === n)) return "FRIEND";
    
    return "NONE";
}

function getCheaterInfo(name) {
    let n = name.toLowerCase().trim();
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
        ChatLib.chat("§c§m---------------------------------------------");
        ChatLib.chat("§c§lSolus Cheater Tracker");
        ChatLib.chat("§c/lc add <pseudo> [raison] §7- Ajouter");
        ChatLib.chat("§c/lc remove <pseudo>        §7- Retirer (local)");
        ChatLib.chat("§c/lc list                   §7- Voir la liste");
        ChatLib.chat("§c§m---------------------------------------------");
        return;
    }

    let action = args[0].toLowerCase();

    if (action === "add" && args[1]) {
        let nameToAdd = args[1];
        let reason = args.slice(2).join(" ") || "Non spécifiée";
        ChatLib.chat(prefix + "§7Recherche de §f" + nameToAdd + "§7...");

        new Thread(() => {
            try {
                let raw = FileLib.getUrlContent("https://api.mojang.com/users/profiles/minecraft/" + nameToAdd);
                let isPremium = false;
                let finalID = nameToAdd.toLowerCase();
                let finalName = nameToAdd;

                if (raw) {
                    let json = JSON.parse(raw);
                    if (json.id) {
                        finalID = json.id;
                        finalName = json.name;
                        isPremium = true;
                    }
                }

                cheatersData.list[finalID] = {
                    name: finalName,
                    reason: reason,
                    premium: isPremium,
                    date: new Date().toLocaleDateString()
                };
                cheatersData.save();
                ChatLib.chat(prefix + "§4§l" + finalName + " §cajouté ! Type: §f" + (isPremium ? "Premium" : "Crack"));
            } catch(e) {
                ChatLib.chat(prefix + "§cErreur lors de l'ajout (API Mojang HS ?).");
            }
        }).start();
    }
    else if (action === "remove" && args[1]) {
        let target = args[1].toLowerCase();
        let found = false;
        for (let id in cheatersData.list) {
            if (cheatersData.list[id].name.toLowerCase() === target) {
                delete cheatersData.list[id];
                found = true;
                break;
            }
        }
        if (found) {
            cheatersData.save();
            ChatLib.chat(prefix + "§a" + args[1] + " retiré des cheaters locaux.");
        } else {
            ChatLib.chat(prefix + "§c" + args[1] + " n'est pas dans ta liste locale.");
        }
    }
    else if (action === "list") {
        ChatLib.chat("§c§lListe des suspects Solus :");
        // Local
        let localKeys = Object.keys(cheatersData.list);
        if (localKeys.length > 0) {
            ChatLib.chat("§e[Local]");
            localKeys.forEach(id => {
                let p = cheatersData.list[id];
                ChatLib.chat(" §7- §c" + p.name + " §8(" + (p.premium ? "P" : "C") + ") §7: §f" + p.reason);
            });
        }
        // Cloud
        let cloudKeys = Object.keys(cloudCheaters);
        if (cloudKeys.length > 0) {
            ChatLib.chat("§6[Cloud]");
            cloudKeys.forEach(id => {
                let p = cloudCheaters[id];
                ChatLib.chat(" §7- §4" + p.name + " §8(" + (p.premium ? "P" : "C") + ") §7: §f" + p.reason);
            });
        }
        if (localKeys.length === 0 && cloudKeys.length === 0) ChatLib.chat("§7Aucun suspect enregistré.");
    }
}).setName("lc");

// --- 4. COMMANDES AMIS (/lf) ---
register("command", (...args) => {
    if (!args || args.length === 0) {
        ChatLib.chat("§2§m---------------------------------------------");
        ChatLib.chat("§2/lf add/remove <pseudo> | /lf pvp | /lf force");
        ChatLib.chat("§2§m---------------------------------------------");
        return;
    }
    let action = args[0].toLowerCase();
    if (action === "add" && args[1]) {
        if (!data.friends.includes(args[1])) {
            data.friends.push(args[1]); data.save();
            ChatLib.chat(prefix + "§a" + args[1] + " ajouté aux amis.");
        }
    } else if (action === "remove" && args[1]) {
        data.friends = data.friends.filter(f => f.toLowerCase() !== args[1].toLowerCase());
        data.save();
        ChatLib.chat(prefix + "§c" + args[1] + " retiré.");
    } else if (action === "pvp") {
        data.pvpEnabled = !data.pvpEnabled; data.save();
        ChatLib.chat(prefix + "PvP Ami : " + (data.pvpEnabled ? "§aON" : "§aOFF"));
    } else if (action === "force") {
        updateCloud(false);
    }
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
            if (!info) return;
            let type = info.premium ? "§b[P]" : "§7[C]";
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
