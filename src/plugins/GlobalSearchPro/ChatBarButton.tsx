/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { React } from "@webpack/common";

import { openGlobalSearchModal } from "./SearchModal";

function SearchIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            role="img"
            fill="currentColor"
        >
            <path d="M10.5 3a7.5 7.5 0 1 1 4.65 13.4l4.73 4.72a1 1 0 0 1-1.42 1.42l-4.72-4.73A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Z" />
        </svg>
    );
}

export const GlobalSearchChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip="Global Search Pro"
            onClick={openGlobalSearchModal}
        >
            <SearchIcon />
        </ChatBarButton>
    );
};
