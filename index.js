// Summarize & Spinoff Character
// Adds a message-menu button that: summarizes the chat so far, adapts the current
// character's description to that summary, generates 3 new opening messages in the
// original's style, and saves it all as a brand-new character (reusing the old avatar).

import { getContext } from "../../../extensions.js";

const BTN_CLASS = "mes_summarize_spinoff";
const THINK_RE = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi;

// --- helpers -----------------------------------------------------------

const stripThink = (text) => text.replace(THINK_RE, "").trim();

// Prefer a "raw" generation (no chat history injected) if the build exposes it,
// otherwise fall back to generateQuietPrompt (chat history gets included, harmless).
async function llm(prompt) {
    const ctx = getContext();
    if (typeof ctx.generateRaw === "function") {
        return await ctx.generateRaw(prompt);
    }
    return await ctx.generateQuietPrompt(prompt, false, false);
}

async function summarizeChat() {
    return stripThink(await llm(
        "Summarize the roleplay so far in a concise paragraph. " +
        "Focus only on plot developments, key events, and the current state of things. " +
        "No commentary, just the summary."
    ));
}

async function adaptDescription(originalDescription, summary) {
    const prompt =
        "Below is a character description, followed by a summary of plot events that happened " +
        "since it was written. Rewrite the description, changing ONLY what is affected by these " +
        "plot developments (relationships, status, location, knowledge, injuries, etc). Leave " +
        "everything else close to verbatim. Output only the revised description, nothing else.\n\n" +
        `### ORIGINAL DESCRIPTION\n${originalDescription}\n\n### SUMMARY OF EVENTS\n${summary}`;
    return stripThink(await llm(prompt));
}

async function generateOpenings(charInfo, firstMes, summary) {
    const prompt =
        "Character info:\n" + charInfo + "\n\n" +
        "Original first message (for writing style/voice reference):\n" + firstMes + "\n\n" +
        "Summary of what has happened so far:\n" + summary + "\n\n" +
        "Write exactly THREE separate new opening/greeting messages for this character, " +
        "written in the same style and voice as the original first message, that fit as a " +
        "continuation after the summarized events. Separate the three messages with a line " +
        "containing only ######. Output nothing else — no preamble, no numbering, no confirmation.";
    const raw = stripThink(await llm(prompt));
    const parts = raw.split(/\n?#{6,}\n?/).map((s) => s.trim()).filter(Boolean);
    // Pad in case the model returned fewer than 3
    while (parts.length < 3) parts.push(parts[0] ?? "");
    return parts.slice(0, 3);
}

// Fetch the original character's avatar image as a Blob, for reuse.
async function fetchAvatarBlob(avatarFileName) {
    const res = await fetch(`/characters/${encodeURIComponent(avatarFileName)}`);
    if (!res.ok) throw new Error("Could not fetch original avatar image");
    return await res.blob();
}

// Creates the new character via ST's character-create endpoint (multipart form).
async function createCharacter(ctx, original, newDescription, greetings, avatarBlob) {
    const headers = ctx.getRequestHeaders();
    delete headers["Content-Type"]; // let the browser set the multipart boundary

    const fd = new FormData();
    fd.append("ch_name", `${original.name} (Continued)`);
    fd.append("description", newDescription);
    fd.append("personality", original.personality ?? "");
    fd.append("scenario", original.scenario ?? "");
    fd.append("mes_example", original.mes_example ?? "");
    fd.append("creatorcomment", original.creatorcomment ?? "");
    fd.append("first_mes", greetings[0]);
    fd.append("alternate_greetings", JSON.stringify(greetings.slice(1)));
    fd.append("talkativeness", original.talkativeness ?? 0.5);
    fd.append("tags", JSON.stringify(original.tags ?? []));
    fd.append("avatar", avatarBlob, "avatar.png");

    const res = await fetch("/api/characters/create", { method: "POST", headers, body: fd });
    if (!res.ok) throw new Error(`Character creation failed: ${res.status}`);
}

// --- main flow -----------------------------------------------------------

async function runSpinoff(button) {
    const ctx = getContext();
    const original = ctx.characters[ctx.characterId];
    if (!original) {
        toastr?.error("No active character selected.");
        return;
    }

    button.classList.add("fa-spin"); // spin the icon while working, if it's a fa-icon button
    try {
        const summary = await summarizeChat();

        const newDescription = await adaptDescription(original.description ?? "", summary);

        const charInfo = [
            `Name: ${original.name}`,
            original.personality ? `Personality: ${original.personality}` : "",
            original.scenario ? `Scenario: ${original.scenario}` : "",
        ].filter(Boolean).join("\n");

        const greetings = await generateOpenings(charInfo, original.first_mes ?? "", summary);

        const avatarBlob = await fetchAvatarBlob(original.avatar);

        await createCharacter(ctx, original, newDescription, greetings, avatarBlob);

        if (typeof ctx.getCharacters === "function") await ctx.getCharacters(); // refresh list
        toastr?.success(`Created "${original.name} (Continued)"`);
    } catch (err) {
        console.error("[summarize-spinoff]", err);
        toastr?.error(err.message ?? "Spinoff character creation failed.");
    } finally {
        button.classList.remove("fa-spin");
    }
}

// --- button injection -----------------------------------------------------

// Adds our button to a single message's button row, if not already present.
function addButtonToMessage(mesElement) {
    const row = mesElement.querySelector(".mes_buttons");
    if (!row || row.querySelector(`.${BTN_CLASS}`)) return;

    const btn = document.createElement("div");
    btn.className = `${BTN_CLASS} mes_button fa-solid fa-book-bookmark interactable`;
    btn.title = "Summarize and make new character";
    btn.tabIndex = 0;
    btn.addEventListener("click", () => runSpinoff(btn));
    row.appendChild(btn);
}

function addButtonsToAllMessages() {
    document.querySelectorAll("#chat .mes").forEach(addButtonToMessage);
}

(function init() {
    const ctx = getContext();
    const { eventSource, event_types } = ctx;

    // Re-scan whenever messages get (re)rendered.
    eventSource.on(event_types.CHAT_CHANGED, addButtonsToAllMessages);
    eventSource.on(event_types.MESSAGE_RENDERED, addButtonsToAllMessages);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, addButtonsToAllMessages);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToAllMessages);

    // Initial pass in case chat is already loaded when the extension boots.
    addButtonsToAllMessages();
})();
