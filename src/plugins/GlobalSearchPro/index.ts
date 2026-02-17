/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

import { GlobalSearchChatBarButton } from "./ChatBarButton";

export default definePlugin({
    name: "GlobalSearchPro",
    description: "Busca global avançada semelhante ao Discord Mobile.",
    authors: [{ name: "taki", id: 0n }],
    version: "1.0.0",
    start() {},
    stop() {},
    renderChatBarButton: GlobalSearchChatBarButton,
});
