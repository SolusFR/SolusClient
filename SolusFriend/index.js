import PogObject from "PogData";

// --- CONFIGURATION ---
const prefix = "§b[Solus] ";
const MODULE_NAME = "SolusFriend"; // /!\ METS LE NOM DE TON DOSSIER ICI
const GITHUB_BASE = "https://raw.githubusercontent.com/SolusFR/SolusClient/main/SolusFriend/";

// Sauvegardes Locales (Dans le même dossier que index.js)
let friendsData = new PogObject(MODULE_NAME, { "list": {} }, "friends.json");
let cheatersData = new PogObject(MODULE_NAME, { "list": {} }, "cheaters.json");
let config = new PogObject(MODULE_NAME, { pvpEnabled: false }, "config.json");

// Listes Cloud
let cloudFriends = {};
let cloudCheaters = {};
let cloudSpecial = { "invincibles": {}, "targets": {} };
let lastUpdate = 0;

const getFormattedDate = () => {
    return new Date().toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' });
};

// --- SYNCHRONISATION CLOUD ---
function updateCloud(silent = true) {
    new Thread(() => {
        try {
            if (!silent) ChatLib.chat(prefix + "§7Synchronisation Cloud...");
            let t = "?t=" + Date.now();
            
            let fJson = FileLib.getUrlContent(GITHUB_BASE + "friends.json" + t);
            if (fJson) cloudFriends = JSON.parse(fJson).list || {};

            let cJson = FileLib.getUrlContent(GITHUB_BASE + "cheaters.json" + t);
            if (cJson) cloudCheaters = JSON.parse(cJson) || {}; // Support list format or direct object

            let sJson = FileLib.getUrlContent(GITHUB_BASE + "special.json" + t);
            if (sJson) cloudSpecial = JSON.parse(sJson) || { "invincibles": {}, "targets": {} };
            
            lastUpdate = Date.now();
            if (!silent) ChatLib.chat(prefix + "§aCloud synchronisé !");
        } catch(e) {
            if (!silent) ChatLib.chat(prefix + "§cErreur Cloud (JSON malformé ou absent).");
        }
    }).start();
}

register("step", () => { if (Date.now() - lastUpdate > 60000) updateCloud(true); }).setDelay(1);
updateCloud(true);

// --- LOGIQUE DE RECHERCHE ---
function isFriend(name) {
    if (!name) return false;
    let n = name.toLowerCase();
    for (let id in friendsData.list) if (friendsData.list[id].name.toLowerCase() === n) return true;
    for (let id in cloudFriends) if (cloudFriends[id].name.toLowerCase() === n) return true;
    return false;
}

function isCheater(name) {
    if (!name) return false;
    let n = name.toLowerCase();
    for (let id in cheatersData.list) if (cheatersData.list[id].name.toLowerCase() === n) return true;
    // Support des deux structures possibles pour le cloud cheaters
    let cList = cloudCheaters.list || cloudCheaters;
    for (let id in cList) if (cList[id].name.toLowerCase() === n) return true;
    return false;
}

function getStatus(name) {
    if (!name) return "NONE";
    let n = name.toLowerCase();
    if (cloudSpecial.invincibles) {
        for (let id in cloudSpecial.invincibles) if (cloudSpecial.invincibles[id].name.toLowerCase() === n) return "INVINCIBLE";
    }
    if (cloudSpecial.targets) {
        for (let id in cloudSpecial.targets) if (cloudSpecial.targets[id].name.toLowerCase() === n) return "TARGET";
    }
    return "NONE";
}

// --- COMMANDES ---

register("command", (action, name, ...extra) => {
    if (!action) {
        ChatLib.chat("§b--- Commandes Amis ---");
        ChatLib.chat("§a/lf add <pseudo>");
        ChatLib.chat("§a/lf remove <pseudo>");
        ChatLib.chat("§a/lf list");
        ChatLib.chat("§a/lf pvp §7(Toggle protection)");
        ChatLib.chat("§a/lf force §7(sync cloud)");
        return;
    }

    if (action === "add" && name) {
        ChatLib.chat(prefix + "§7Ajout de " + name + "...");
        new Thread(() => {
            let id = name.toLowerCase(), prem = false, realName = name;
            try {
                let raw = FileLib.getUrlContent("https://api.mojang.com/users/profiles/minecraft/" + name);
                if (raw) {
                    let j = JSON.parse(raw);
                    id = j.id; realName = j.name; prem = true;
                }
            } catch(e) {}
            
            friendsData.list[id] = {
                "name": realName,
                "premium": prem,
                "date": getFormattedDate()
            };
            friendsData.save();
            ChatLib.chat(prefix + "§a" + realName + " ajouté !");
        }).start();
    } else if (action === "remove" && name) {
        let found = false;
        for (let id in friendsData.list) {
            if (friendsData.list[id].name.toLowerCase() === name.toLowerCase()) {
                delete friendsData.list[id];
                friendsData.save();
                ChatLib.chat(prefix + "§c" + name + " retiré.");
                found = true; break;
            }
        }
        if (!found) ChatLib.chat(prefix + "§7Pas trouvé en local.");
    } else if (action === "list") {
        ChatLib.chat(prefix + "§aAmis: " + Object.values(friendsData.list).map(f => f.name).join(", "));
    } else if (action === "pvp") {
        config.pvpEnabled = !config.pvpEnabled;
        config.save();
        let state = config.pvpEnabled ? "§aACTIVÉ (Protection OFF)" : "§cDÉSACTIVÉ (Protection ON)";
        ChatLib.chat(prefix + "PvP Ami: " + state);
    } else if (action === "force") {
        updateCloud(false);
    }
}).setName("lf");

register("command", (action, name, ...reasonParts) => {
    if (!action) {
        ChatLib.chat("§c--- Commandes Cheaters ---");
        ChatLib.chat("§c/lc add <pseudo> [raison]");
        ChatLib.chat("§c/lc remove <pseudo>");
        ChatLib.chat("§c/lc list");
        return;
    }

    if (action === "add" && name) {
        let reason = reasonParts.join(" ") || "Cheating";
        ChatLib.chat(prefix + "§7Signalement de " + name + "...");
        new Thread(() => {
            let id = name.toLowerCase(), prem = false, realName = name;
            try {
                let raw = FileLib.getUrlContent("https://api.mojang.com/users/profiles/minecraft/" + name);
                if (raw) {
                    let j = JSON.parse(raw);
                    id = j.id; realName = j.name; prem = true;
                }
            } catch(e) {}
            
            cheatersData.list[id] = {
                "name": realName,
                "premium": prem,
                "date": getFormattedDate(),
                "reason": reason
            };
            cheatersData.save();
            ChatLib.chat(prefix + "§4" + realName + " marqué pour: " + reason);
        }).start();
    } else if (action === "remove" && name) {
        for (let id in cheatersData.list) {
            if (cheatersData.list[id].name.toLowerCase() === name.toLowerCase()) {
                delete cheatersData.list[id];
                cheatersData.save();
                ChatLib.chat(prefix + "§a" + name + " retiré.");
                break;
            }
        }
    } else if (action === "list") {
        ChatLib.chat(prefix + "§cCheaters: " + Object.values(cheatersData.list).map(c => c.name).join(", "));
    }
}).setName("lc");

// --- VISUELS ---

register("attackEntity", (entity, event) => {
    if (entity.getClassName() !== "EntityOtherPlayerMP") return;
    let n = entity.getName();
    // Bloque l'attaque si c'est un invincible OU (si c'est un ami ET que le pvpEnabled est false)
    if (getStatus(n) === "INVINCIBLE" || (isFriend(n) && !config.pvpEnabled)) {
        cancel(event);
        World.playSound("random.anvil_land", 0.5, 0.5);
    }
});

register("renderWorld", () => {
    World.getAllPlayers().forEach(p => {
        let n = p.getName();
        if (n === Player.getName()) return;
        
        let friend = isFriend(n), cheater = isCheater(n), god = (getStatus(n) === "INVINCIBLE"), target = (getStatus(n) === "TARGET");
        if (!friend && !cheater && !god && !target) return;
        if (Player.asPlayerMP().distanceTo(p) > 30) return;

        let tags = [];
        if (god) tags.push("§d§l🛡 GOD 🛡");
        if (target) tags.push("§c§l⚠ TARGET ⚠");
        if (friend) tags.push("§a★ AMI ★");
        if (cheater) tags.push("§4§l⚠ CHEATER ⚠");

        Tessellator.drawString(tags.join(" §8| "), p.getRenderX(), p.getRenderY() + p.getHeight() + 0.5, p.getRenderZ(), 0, true, 0.03, false);
    });
});
