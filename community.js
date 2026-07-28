// Community chat: Firebase Auth + Firestore first, Socket.io/local backend fallback.
// Works on Firebase Hosting for logged-in users and also in local/Render Node mode.
(function () {
  "use strict";

  const DEFAULT_AVATAR = "/images/misc/anonymouse.png";
  const MAX_MESSAGES = 200;
  const MAX_MESSAGE_LENGTH = 500;

  function formatTimestamp(timestamp) {
    let date;
    if (timestamp && typeof timestamp.toDate === "function") date = timestamp.toDate();
    else if (timestamp && typeof timestamp.seconds === "number") date = new Date(timestamp.seconds * 1000);
    else if (timestamp) date = new Date(timestamp);
    else date = new Date();

    if (Number.isNaN(date.getTime())) date = new Date();

    const now = new Date();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return `today ${hours}:${minutes}`;
    if (isYesterday) return `yesterday ${hours}:${minutes}`;

    const daysDiff = Math.floor((now - date) / (24 * 60 * 60 * 1000));
    if (daysDiff > 7) {
      const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();
      return `${month} ${date.getDate()} ${hours}:${minutes}`;
    }

    const weekday = date.toLocaleString("en-US", { weekday: "long" }).toLowerCase();
    return `${weekday} ${hours}:${minutes}`;
  }

  function safeLower(value) {
    return String(value || "").toLowerCase();
  }

  function hasFirebaseCompat() {
    return typeof window.firebase !== "undefined" &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function";
  }

  function getFirebaseAuth() {
    if (window.TrueSkyAuth && window.TrueSkyAuth.auth) return window.TrueSkyAuth.auth;
    if (hasFirebaseCompat()) {
      try { return window.firebase.auth(); } catch (_) { return null; }
    }
    return null;
  }

  function getFirebaseDb() {
    if (hasFirebaseCompat()) {
      try { return window.firebase.firestore(); } catch (_) { return null; }
    }
    return null;
  }

  function waitForFirebaseUser(timeoutMs) {
    return new Promise((resolve) => {
      const auth = getFirebaseAuth();
      if (!auth || typeof auth.onAuthStateChanged !== "function") {
        resolve(null);
        return;
      }
      if (auth.currentUser) {
        resolve(auth.currentUser);
        return;
      }

      let settled = false;
      let unsubscribe = null;
      const timer = setTimeout(() => finish(null), timeoutMs || 7000);

      function finish(user) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { if (unsubscribe) unsubscribe(); } catch (_) {}
        resolve(user || auth.currentUser || null);
      }

      try {
        unsubscribe = auth.onAuthStateChanged((user) => finish(user || null));
      } catch (_) {
        finish(null);
      }
    });
  }

  async function readUserProfile(user) {
    const db = getFirebaseDb();
    if (!db || !user) return {};
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      return snap.exists ? (snap.data() || {}) : {};
    } catch (err) {
      console.warn("Could not read Firebase user profile for chat:", err);
      return {};
    }
  }

  async function syncCurrentUser(user) {
    const profile = await readUserProfile(user);
    const token = user && typeof user.getIdTokenResult === "function"
      ? await user.getIdTokenResult().catch(() => null)
      : null;
    const claims = (token && token.claims) || {};

    const displayName =
      profile.displayName ||
      profile.display_name ||
      (user && user.displayName) ||
      (user && user.email ? user.email.split("@")[0] : "User");
    const photoURL = profile.photoURL || profile.photo_url || (user && user.photoURL) || DEFAULT_AVATAR;
    const role = profile.community_role || profile.role || claims.role || (claims.admin ? "admin" : "user");

    window.currentUser = displayName;
    window.currentUserIsAdmin = safeLower(role) === "admin" || claims.admin === true;
    window.user = Object.assign({}, window.user || {}, {
      id: user ? user.uid : "local",
      uid: user ? user.uid : "local",
      email: user ? (user.email || null) : null,
      display_name: displayName,
      profile_image: photoURL,
      photoURL,
      community_role: role,
      subscription_status: "free"
    });

    if (document.body) {
      document.body.setAttribute("data-user-id", window.user.id);
      document.body.setAttribute("data-current-user", displayName);
      document.body.setAttribute("data-user-role", role);
    }

    const userInfo = document.getElementById("user-info");
    if (userInfo) {
      const img = userInfo.querySelector("img");
      const span = userInfo.querySelector("span");
      if (img) img.src = photoURL;
      if (span) span.textContent = displayName;
    }

    window.dispatchEvent(new CustomEvent("truesky-chat-user-ready", { detail: { user: window.user } }));
    return window.user;
  }

  function makeMessageId() {
    return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeMessage(raw) {
    const msg = raw || {};
    const timestamp = msg.timestamp || msg.created_at || msg.createdAt || Date.now();
    const username = msg.username || msg.displayName || msg.display_name || "User";
    const userId = msg.userId || msg.user_id || msg.uid || "";
    const profileImage = msg.profileImage || msg.profile_image || msg.photoURL || msg.photo_url || DEFAULT_AVATAR;
    const role = msg.role || msg.community_role || "user";
    return {
      id: msg.id || makeMessageId(),
      channel: msg.channel || "welcome",
      userId,
      user_id: userId,
      username,
      message: String(msg.message || ""),
      profileImage,
      profile_image: profileImage,
      role,
      community_role: role,
      anonymous: !!msg.anonymous,
      timestamp
    };
  }

  function showChatNotice(chatBox, text, isError) {
    if (!chatBox) return;
    chatBox.innerHTML = "";
    const div = document.createElement("div");
    div.style.textAlign = "center";
    div.style.padding = "20px";
    div.style.color = isError ? "#b00020" : "#777";
    div.textContent = text;
    chatBox.appendChild(div);
  }

  function setInputEnabled(enabled, placeholder) {
    const input = document.getElementById("chatInput");
    const button = document.getElementById("sendMessage");
    if (input) {
      input.disabled = !enabled;
      input.placeholder = enabled ? (placeholder || input.getAttribute("data-original-placeholder") || "Type your message here...") : (placeholder || "");
    }
    if (button) button.disabled = !enabled;
  }

  function renderMessage(chatBox, message, currentUserId, deleteHandler) {
    const data = normalizeMessage(message);
    if (!data.message.trim()) return;

    const existing = document.getElementById(`message-${data.id}`);
    if (existing) existing.remove();

    const msgContainer = document.createElement("div");
    msgContainer.id = `message-${data.id}`;
    msgContainer.style.display = "flex";
    msgContainer.style.alignItems = "flex-start";
    msgContainer.style.marginBottom = "5px";

    const img = new Image();
    img.alt = data.username;
    img.style.width = "26px";
    img.style.height = "26px";
    img.style.borderRadius = "50%";
    img.style.marginRight = "10px";
    img.style.objectFit = "cover";

    const messageContainer = document.createElement("div");
    messageContainer.style.wordWrap = "break-word";
    messageContainer.style.whiteSpace = "pre-wrap";
    messageContainer.style.maxWidth = "90%";
    messageContainer.style.fontSize = "18px";

    const usernameSpan = document.createElement("span");
    usernameSpan.textContent = data.username;
    usernameSpan.style.fontWeight = "bold";
    usernameSpan.style.cursor = "pointer";
    usernameSpan.classList.add("username-mention");
    usernameSpan.setAttribute("data-username", data.username);
    messageContainer.appendChild(usernameSpan);

    if (safeLower(data.role) === "admin") {
      usernameSpan.style.color = "#2c3d4f";
      const badgeImg = document.createElement("img");
      badgeImg.src = "/images/misc/badge.svg";
      badgeImg.alt = "Admin Badge";
      badgeImg.style.width = "18px";
      badgeImg.style.height = "18px";
      badgeImg.style.verticalAlign = "middle";
      badgeImg.style.marginBottom = "6px";
      badgeImg.style.marginRight = "-2px";
      messageContainer.appendChild(badgeImg);
    }

    const timeSpan = document.createElement("span");
    timeSpan.textContent = `  ${formatTimestamp(data.timestamp)}`;
    timeSpan.style.fontSize = "12px";
    timeSpan.style.color = "#777";
    timeSpan.style.fontFamily = "Geneva, sans-serif";
    timeSpan.style.position = "relative";
    timeSpan.style.top = "-1px";
    messageContainer.appendChild(timeSpan);

    const isMessageOwner = data.userId && String(data.userId) === String(currentUserId || "");
    if ((window.currentUserIsAdmin || isMessageOwner) && typeof deleteHandler === "function") {
      const deleteLink = document.createElement("span");
      deleteLink.textContent = "  remove";
      deleteLink.style.fontSize = "12px";
      deleteLink.style.color = "#777";
      deleteLink.style.fontFamily = "Geneva, sans-serif";
      deleteLink.style.position = "relative";
      deleteLink.style.top = "-1px";
      deleteLink.style.cursor = "pointer";
      deleteLink.addEventListener("click", () => deleteHandler(data.id));
      messageContainer.appendChild(deleteLink);
    }

    const messageText = document.createElement("div");
    messageText.textContent = data.message;
    messageText.style.marginTop = "2px";
    messageContainer.appendChild(messageText);

    const currentUser = window.currentUser || "";
    if (currentUser && safeLower(currentUser) !== "anonymous" && safeLower(data.username) === safeLower(currentUser)) {
      usernameSpan.style.fontWeight = "bold";
    } else if (currentUser && safeLower(currentUser) !== "anonymous" && safeLower(data.message).includes("@" + safeLower(currentUser))) {
      messageText.style.fontWeight = "bold";
    }

    const append = () => {
      msgContainer.appendChild(img);
      msgContainer.appendChild(messageContainer);
      chatBox.appendChild(msgContainer);
      chatBox.scrollTop = chatBox.scrollHeight;
    };
    img.onload = append;
    img.onerror = append;
    img.src = data.profileImage || DEFAULT_AVATAR;
  }

  function setupMentionClicks() {
    document.body.addEventListener("click", function (event) {
      if (!event.target.classList.contains("username-mention")) return;
      const clickedUser = event.target.getAttribute("data-username");
      if (!clickedUser) return;
      if (window.currentUser && safeLower(window.currentUser.trim()) === safeLower(clickedUser.trim())) return;

      const chatInput = document.getElementById("chatInput");
      if (!chatInput) return;

      const newMention = `@${clickedUser}: `;
      const currentValue = chatInput.value;
      if (currentValue.startsWith("@")) {
        const mentionRegex = /^@[^:]+:\s/;
        if (mentionRegex.test(currentValue)) {
          chatInput.value = currentValue.replace(mentionRegex, newMention);
        } else {
          const firstSpace = currentValue.indexOf(" ");
          chatInput.value = firstSpace !== -1 ? newMention + currentValue.slice(firstSpace + 1) : newMention;
        }
      } else {
        chatInput.value = newMention + currentValue;
      }
      chatInput.focus();
      chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    });
  }

  function setupLayout(chatBox) {
    chatBox.style.border = "none";
    chatBox.style.maxWidth = "625px";
    chatBox.style.margin = "0 auto";
    chatBox.style.textAlign = "left";

    function updateChatBoxHeight() {
      const channelSelection = document.getElementById("channel-selection");
      const chatInputRow = document.getElementById("chatInputRow");
      const header = document.querySelector("header");
      const availableHeight =
        window.innerHeight -
        (header ? header.offsetHeight : 0) -
        (channelSelection ? channelSelection.offsetHeight : 0) -
        (chatInputRow ? chatInputRow.offsetHeight : 0) -
        20 -
        110;
      chatBox.style.height = Math.max(200, availableHeight) + "px";
    }

    const showCommunity = document.getElementById("showCommunity");
    if (showCommunity) {
      const observer = new MutationObserver(() => {
        if (showCommunity.style.display !== "none") updateChatBoxHeight();
      });
      observer.observe(showCommunity, { attributes: true, attributeFilter: ["style"] });
    }
    window.addEventListener("resize", () => {
      if (!showCommunity || showCommunity.style.display !== "none") updateChatBoxHeight();
    });
    updateChatBoxHeight();
    window.TrueSkyUpdateChatBoxHeight = updateChatBoxHeight;
  }

  async function startFirestoreChat(chatBox, channel, firebaseUser) {
    const db = getFirebaseDb();
    if (!db || !firebaseUser) return null;

    const user = await syncCurrentUser(firebaseUser);
    const messagesRef = db.collection("communityChat").doc(channel).collection("messages");
    const input = document.getElementById("chatInput");
    const button = document.getElementById("sendMessage");
    const anonymousCheckbox = document.getElementById("anonymousCheckbox");
    let lastSentMessage = "";
    let lastSentTime = 0;
    let unsubscribe = null;

    setInputEnabled(true);
    showChatNotice(chatBox, "Carregando chat...", false);

    function deleteMessage(id) {
      messagesRef.doc(id).delete().catch((err) => {
        const errorElem = document.getElementById("chatErrorMessage");
        if (errorElem) errorElem.textContent = err && err.message ? err.message : "Não foi possível remover a mensagem.";
      });
    }

    unsubscribe = messagesRef
      .orderBy("timestamp", "asc")
      .limit(MAX_MESSAGES)
      .onSnapshot((snapshot) => {
        chatBox.innerHTML = "";
        if (snapshot.empty) {
          showChatNotice(chatBox, "Chat vazio. Envie a primeira mensagem.", false);
          return;
        }
        snapshot.forEach((doc) => renderMessage(chatBox, Object.assign({ id: doc.id }, doc.data()), user.id, deleteMessage));
        chatBox.scrollTop = chatBox.scrollHeight;
      }, (err) => {
        console.error("Firestore chat error:", err);
        showChatNotice(chatBox, "Não foi possível carregar o chat no Firestore. Confira login e regras do Firebase.", true);
      });

    async function sendMessage() {
      if (!input) return;
      const message = input.value.trim();
      if (!message) return;
      const now = Date.now();
      if (message === lastSentMessage && now - lastSentTime < 10000) {
        input.value = "";
        input.style.height = "auto";
        if (window.TrueSkyUpdateChatBoxHeight) window.TrueSkyUpdateChatBoxHeight();
        const errorElem = document.getElementById("chatErrorMessage");
        if (errorElem) {
          errorElem.textContent = "Duplicate message. Message already sent.";
          setTimeout(() => { errorElem.textContent = ""; }, 3000);
        }
        return;
      }

      lastSentMessage = message;
      lastSentTime = now;
      input.value = "";
      input.style.height = "auto";
      if (window.TrueSkyUpdateChatBoxHeight) window.TrueSkyUpdateChatBoxHeight();

      const anonymous = anonymousCheckbox ? anonymousCheckbox.checked : false;
      const payload = {
        channel,
        userId: user.id,
        username: anonymous ? "Anonymous" : (window.currentUser || user.display_name || "User"),
        message: message.slice(0, MAX_MESSAGE_LENGTH),
        profileImage: anonymous ? DEFAULT_AVATAR : (user.profile_image || user.photoURL || DEFAULT_AVATAR),
        role: anonymous ? "user" : (user.community_role || "user"),
        anonymous,
        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      try {
        await messagesRef.add(payload);
      } catch (err) {
        input.value = message;
        const errorElem = document.getElementById("chatErrorMessage");
        if (errorElem) errorElem.textContent = err && err.message ? err.message : "Não foi possível enviar a mensagem.";
        console.error("Could not send Firestore chat message:", err);
      }
    }

    if (button) button.addEventListener("click", sendMessage);
    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });
    }

    return { unsubscribe };
  }

  function startSocketChat(chatBox, channel) {
    if (typeof window.io !== "function") {
      showChatNotice(chatBox, "Chat indisponível: Firebase/Socket.io não carregou.", true);
      setInputEnabled(false, "Faça login novamente para usar o chat...");
      return;
    }

    const currentUserId = document.body.getAttribute("data-user-id") || (window.user && (window.user.uid || window.user.id)) || "local";
    window.currentUser = document.body.getAttribute("data-current-user") || (window.user && window.user.display_name) || "User";
    window.currentUserIsAdmin = safeLower(document.body.getAttribute("data-user-role")) === "admin";

    const socketBaseUrl = (window.TRUESKY_API_BASE_URL || "").replace(/\/+$/, "");
    const socket = window.io(socketBaseUrl || undefined, {
      transports: ["polling", "websocket"],
      withCredentials: true,
    });
    const input = document.getElementById("chatInput");
    const button = document.getElementById("sendMessage");
    const anonymousCheckbox = document.getElementById("anonymousCheckbox");
    const seen = new Set();
    let lastSentMessage = "";
    let lastSentTime = 0;

    function deleteMessage(id) {
      fetch("/delete-chat-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, channel }),
        credentials: "same-origin",
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            const elem = document.getElementById(`message-${id}`);
            if (elem) elem.remove();
          }
        })
        .catch((err) => console.error("Deletion error", err));
    }

    function appendMessage(raw) {
      const message = normalizeMessage(raw);
      if (message.channel !== channel || seen.has(message.id)) return;
      seen.add(message.id);
      renderMessage(chatBox, message, currentUserId, deleteMessage);
    }

    function loadHistory() {
      fetch(`/chat-history/${encodeURIComponent(channel)}`, { credentials: "same-origin" })
        .then((response) => response.json())
        .then((payload) => {
          const messages = Array.isArray(payload) ? payload : (payload.messages || []);
          chatBox.innerHTML = "";
          seen.clear();
          if (!messages.length) {
            showChatNotice(chatBox, "Chat vazio. Envie a primeira mensagem.", false);
            return;
          }
          messages.forEach(appendMessage);
          chatBox.scrollTop = chatBox.scrollHeight;
        })
        .catch((err) => {
          console.error("Error fetching chat history for channel:", err);
          showChatNotice(chatBox, "Não foi possível carregar o histórico do chat.", true);
        });
    }

    function sendMessage() {
      if (!input) return;
      const message = input.value.trim();
      if (!message) return;
      const now = Date.now();
      if (message === lastSentMessage && now - lastSentTime < 10000) {
        input.value = "";
        input.style.height = "auto";
        if (window.TrueSkyUpdateChatBoxHeight) window.TrueSkyUpdateChatBoxHeight();
        return;
      }
      lastSentMessage = message;
      lastSentTime = now;
      input.value = "";
      input.style.height = "auto";
      if (window.TrueSkyUpdateChatBoxHeight) window.TrueSkyUpdateChatBoxHeight();

      const anonymous = anonymousCheckbox ? anonymousCheckbox.checked : false;
      socket.emit("chatMessage", {
        channel,
        userId: currentUserId,
        user_id: currentUserId,
        username: anonymous ? "Anonymous" : window.currentUser,
        message: message.slice(0, MAX_MESSAGE_LENGTH),
        profileImage: anonymous ? DEFAULT_AVATAR : ((window.user && (window.user.profile_image || window.user.photoURL)) || DEFAULT_AVATAR),
        profile_image: anonymous ? DEFAULT_AVATAR : ((window.user && (window.user.profile_image || window.user.photoURL)) || DEFAULT_AVATAR),
        role: anonymous ? "user" : ((window.user && window.user.community_role) || "user"),
        community_role: anonymous ? "user" : ((window.user && window.user.community_role) || "user"),
        anonymous,
        timestamp: new Date().toISOString()
      });
    }

    socket.on("connect", () => socket.emit("joinChannel", channel));
    socket.on("chatMessage", appendMessage);
    socket.on("chat message", appendMessage);
    socket.on("messageDeleted", (data) => {
      const elem = document.getElementById(`message-${data.id}`);
      if (elem) elem.remove();
    });
    socket.on("errorMessage", (data) => {
      const errorElem = document.getElementById("chatErrorMessage");
      if (errorElem) {
        errorElem.textContent = data && data.text ? data.text : "Erro no chat.";
        setTimeout(() => { errorElem.textContent = ""; }, 5000);
      }
    });

    setInputEnabled(true);
    loadHistory();
    if (button) button.addEventListener("click", sendMessage);
    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const chatBox = document.getElementById("chatBox");
    const input = document.getElementById("chatInput");
    if (!chatBox || !input) return;

    input.setAttribute("data-original-placeholder", input.getAttribute("placeholder") || "Type your message here...");
    input.addEventListener("input", function () {
      const lines = this.value.split("\n");
      if (lines.length > 6) this.value = lines.slice(0, 6).join("\n");
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
      if (window.TrueSkyUpdateChatBoxHeight) window.TrueSkyUpdateChatBoxHeight();
    });

    setupLayout(chatBox);
    setupMentionClicks();

    let currentChannel = "welcome";
    window.currentChannel = currentChannel;

    const channelButtons = document.querySelectorAll(".channel-btn");
    channelButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        channelButtons.forEach((b) => b.classList.remove("active-channel"));
        btn.classList.add("active-channel");
        const requestedChannel = btn.getAttribute("data-channel") || "welcome";
        if (requestedChannel === "ai" && window.aiChat) {
          currentChannel = "ai";
          window.currentChannel = currentChannel;
          window.aiChat.activate();
          return;
        }
        window.location.reload();
      });
    });

    if (currentChannel === "ai" && window.aiChat) {
      window.aiChat.activate();
      return;
    }

    const firebaseUser = await waitForFirebaseUser(8000);
    if (firebaseUser && getFirebaseDb()) {
      await startFirestoreChat(chatBox, currentChannel, firebaseUser);
      return;
    }

    if (hasFirebaseCompat() && getFirebaseAuth()) {
      showChatNotice(chatBox, "Entre com Firebase para usar o chat online.", true);
      setInputEnabled(false, "Faça login para enviar mensagem...");
      return;
    }

    startSocketChat(chatBox, currentChannel);
  });
})();
