/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { findByPropsLazy } from "@webpack";
import { Button, ChannelRouter, Flex, Forms, React, RestAPI, ScrollerAuto, TabBar, Text, TextInput, Timestamp, useEffect, useMemo, useRef, useState } from "@webpack/common";

type JumpToMessageArgs = {
    channelId: string;
    messageId: string;
    flash?: boolean;
    jumpType?: string;
};

const Kangaroo: unknown = findByPropsLazy("jumpToMessage");

type SearchTab = "messages" | "media" | "files";

interface SearchMessageAuthor {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
}

interface SearchMessageAttachment {
    id: string;
    filename: string;
    size?: number;
    url?: string;
    proxy_url?: string;
    content_type?: string;
    width?: number;
    height?: number;
}

interface SearchMessage {
    id: string;
    channel_id: string;
    content: string;
    timestamp: string;
    author: SearchMessageAuthor;
    attachments: SearchMessageAttachment[];
}

interface SearchTabResult {
    messages: SearchMessage[];
    cursor: string | null;
    hasSearched: boolean;
}

interface MediaItem {
    message: SearchMessage;
    attachment: SearchMessageAttachment;
}

interface FileItem {
    message: SearchMessage;
    attachment: SearchMessageAttachment;
}

const TABS: Array<{ id: SearchTab; label: string; }> = [
    { id: "messages", label: "Messages" },
    { id: "media", label: "Media" },
    { id: "files", label: "Files" },
];

const EMPTY_RESULTS: SearchTabResult = {
    messages: [],
    cursor: null,
    hasSearched: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isString = (value: unknown): value is string =>
    typeof value === "string";

const getString = (value: Record<string, unknown>, key: string) =>
    isString(value[key]) ? value[key] : undefined;

function toAuthor(value: unknown): SearchMessageAuthor {
    if (!isRecord(value)) {
        return { id: "0", username: "Unknown User", global_name: null, avatar: null };
    }

    return {
        id: getString(value, "id") ?? "0",
        username: getString(value, "username") ?? "Unknown User",
        global_name: getString(value, "global_name") ?? null,
        avatar: getString(value, "avatar") ?? null,
    };
}

function toAttachments(value: unknown): SearchMessageAttachment[] {
    if (!Array.isArray(value)) return [];

    const attachments: SearchMessageAttachment[] = [];
    for (const raw of value) {
        if (!isRecord(raw)) continue;
        const id = getString(raw, "id");
        const filename = getString(raw, "filename");
        if (!id || !filename) continue;

        attachments.push({
            id,
            filename,
            size: typeof raw.size === "number" ? raw.size : undefined,
            url: getString(raw, "url"),
            proxy_url: getString(raw, "proxy_url"),
            content_type: getString(raw, "content_type"),
            width: typeof raw.width === "number" ? raw.width : undefined,
            height: typeof raw.height === "number" ? raw.height : undefined,
        });
    }

    return attachments;
}

function toSearchMessage(value: unknown): SearchMessage | null {
    if (!isRecord(value)) return null;
    const id = getString(value, "id");
    const channelId = getString(value, "channel_id");
    if (!id || !channelId) return null;

    return {
        id,
        channel_id: channelId,
        content: getString(value, "content") ?? "",
        timestamp: getString(value, "timestamp") ?? new Date(0).toISOString(),
        author: toAuthor(value.author),
        attachments: toAttachments(value.attachments),
    };
}

function normalizeMessages(value: unknown): SearchMessage[] {
    if (!Array.isArray(value)) return [];
    const flattened = value.flatMap(entry => Array.isArray(entry) ? entry : [entry]);
    const messages: SearchMessage[] = [];
    for (const entry of flattened) {
        const message = toSearchMessage(entry);
        if (message) messages.push(message);
    }
    return messages;
}

function parseSearchResponse(body: unknown, tab: SearchTab): { messages: SearchMessage[]; cursor: string | null; } {
    if (!isRecord(body)) return { messages: [], cursor: null };
    const tabs = isRecord(body.tabs) ? body.tabs : undefined;
    if (!tabs) return { messages: [], cursor: null };

    const tabValue = tabs[tab];
    if (!isRecord(tabValue)) return { messages: [], cursor: null };

    const messages = normalizeMessages(tabValue.messages);
    const cursor = isString(tabValue.cursor) ? tabValue.cursor : null;

    return { messages, cursor };
}

function mergeMessages(existing: SearchMessage[], incoming: SearchMessage[]) {
    const seen = new Set(existing.map(message => message.id));
    const merged = [...existing];
    for (const message of incoming) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        merged.push(message);
    }
    return merged;
}

function uniqueMessages(messages: SearchMessage[]) {
    const seen = new Set<string>();
    const unique: SearchMessage[] = [];
    for (const message of messages) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        unique.push(message);
    }
    return unique;
}

function formatBytes(size?: number) {
    if (size == null || Number.isNaN(size)) return "Unknown size";
    if (size < 1024) return `${size} B`;
    const units = ["KB", "MB", "GB"];
    let value = size / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function getDefaultAvatarUrl(userId: string) {
    try {
        const index = Number(BigInt(userId) % 5n);
        return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    } catch {
        return "https://cdn.discordapp.com/embed/avatars/0.png";
    }
}

function getAvatarUrl(author: SearchMessageAuthor) {
    if (!author.avatar) return getDefaultAvatarUrl(author.id);
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=96`;
}

function isImageAttachment(attachment: SearchMessageAttachment) {
    const type = attachment.content_type ?? "";
    if (type.startsWith("image/")) return true;
    return /\.(png|jpg|jpeg|gif|webp)$/i.test(attachment.filename);
}

function isVideoAttachment(attachment: SearchMessageAttachment) {
    const type = attachment.content_type ?? "";
    if (type.startsWith("video/")) return true;
    return /\.(mp4|webm|mov)$/i.test(attachment.filename);
}

function buildSearchRequest(activeTab: SearchTab, query: string, authorId: string, cursor: string | null) {
    return {
        tabs: {
            [activeTab]: {
                sort_by: "timestamp",
                sort_order: "desc",
                content: query,
                limit: 25,
                cursor,
                ...(activeTab === "media" ? { has: ["image", "video"] } : {}),
                ...(activeTab === "files" ? { has: ["file"] } : {}),
                ...(authorId ? { author_id: authorId } : {})
            }
        },
        track_exact_total_hits: false
    };
}

function hasJumpToMessage(value: unknown): value is { jumpToMessage: (args: JumpToMessageArgs) => void; } {
    return isRecord(value) && typeof value["jumpToMessage"] === "function";
}

function navigateToMessage(message: SearchMessage) {
    ChannelRouter.transitionToChannel(message.channel_id);
    if (hasJumpToMessage(Kangaroo)) {
        Kangaroo.jumpToMessage({
            channelId: message.channel_id,
            messageId: message.id,
            flash: true,
            jumpType: "INSTANT"
        });
    }
}

export function openGlobalSearchModal() {
    openModal(modalProps => <GlobalSearchModal modalProps={modalProps} />);
}

export function GlobalSearchModal({ modalProps }: { modalProps: ModalProps; }) {
    const [query, setQuery] = useState("");
    const [authorId, setAuthorId] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [activeTab, setActiveTab] = useState<SearchTab>("messages");
    const [results, setResults] = useState<SearchTabResult>(EMPTY_RESULTS);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cacheRef = useRef(new Map<string, SearchTabResult>());
    const requestIdRef = useRef(0);

    const trimmedQuery = useMemo(() => query.trim(), [query]);
    const trimmedAuthorId = useMemo(() => authorId.trim(), [authorId]);
    const cacheKey = useMemo(
        () => `${activeTab}:${debouncedQuery}:${trimmedAuthorId}`,
        [activeTab, debouncedQuery, trimmedAuthorId]
    );
    const canSearch = debouncedQuery.length > 0 || trimmedAuthorId.length > 0;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(trimmedQuery), 350);
        return () => clearTimeout(timer);
    }, [trimmedQuery]);

    useEffect(() => {
        if (!canSearch) {
            setResults(EMPTY_RESULTS);
            setError(null);
            return;
        }

        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setResults(cached);
            setError(null);
            return;
        }

        void runSearch(false);
    }, [cacheKey, canSearch]);

    async function runSearch(append: boolean, overrideQuery?: string) {
        const queryValue = overrideQuery ?? debouncedQuery;
        const targetKey = overrideQuery != null ? `${activeTab}:${queryValue}:${trimmedAuthorId}` : cacheKey;
        const canSearchNow = queryValue.length > 0 || trimmedAuthorId.length > 0;
        if (!canSearchNow) return;

        const cached = cacheRef.current.get(targetKey) ?? EMPTY_RESULTS;
        const cursor = append ? cached.cursor : null;
        if (append && !cursor) return;

        const requestBody = buildSearchRequest(activeTab, queryValue, trimmedAuthorId, cursor);
        const currentRequestId = requestIdRef.current + 1;
        requestIdRef.current = currentRequestId;

        setIsLoading(true);
        setError(null);

        try {
            const { body } = await RestAPI.post({
                url: "/users/@me/messages/search/tabs",
                body: requestBody
            });

            if (requestIdRef.current !== currentRequestId) return;

            const { messages, cursor: nextCursor } = parseSearchResponse(body, activeTab);
            const mergedMessages = append
                ? mergeMessages(cached.messages, messages)
                : uniqueMessages(messages);

            const nextResults: SearchTabResult = {
                messages: mergedMessages,
                cursor: nextCursor,
                hasSearched: true
            };

            cacheRef.current.set(targetKey, nextResults);
            setResults(nextResults);
        } catch {
            if (requestIdRef.current !== currentRequestId) return;
            setError("Search failed. Please try again.");
        } finally {
            if (requestIdRef.current === currentRequestId) {
                setIsLoading(false);
            }
        }
    }

    const mediaItems = useMemo(() => {
        if (activeTab !== "media") return [] as MediaItem[];
        const items: MediaItem[] = [];
        for (const message of results.messages) {
            for (const attachment of message.attachments) {
                if (isImageAttachment(attachment) || isVideoAttachment(attachment)) {
                    items.push({ message, attachment });
                }
            }
        }
        return items;
    }, [activeTab, results.messages]);

    const fileItems = useMemo(() => {
        if (activeTab !== "files") return [] as FileItem[];
        const items: FileItem[] = [];
        for (const message of results.messages) {
            for (const attachment of message.attachments) {
                if (!isImageAttachment(attachment) && !isVideoAttachment(attachment)) {
                    items.push({ message, attachment });
                }
            }
        }
        return items;
    }, [activeTab, results.messages]);

    const showEmptyState = results.hasSearched && !isLoading && !error && (
        activeTab === "media"
            ? mediaItems.length === 0
            : activeTab === "files"
                ? fileItems.length === 0
                : results.messages.length === 0
    );

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flex: 1 }}>
                    GlobalSearchPro
                </Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Flex direction={Flex.Direction.VERTICAL} style={{ gap: "12px" }}>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                        <div style={{ flex: "1 1 300px" }}>
                            <Forms.FormTitle tag="h3">Search Query</Forms.FormTitle>
                            <TextInput
                                value={query}
                                placeholder="Search messages"
                                onChange={value => setQuery(String(value))}
                                onKeyDown={event => {
                                    if (event.key === "Enter") {
                                        setDebouncedQuery(trimmedQuery);
                                        void runSearch(false, trimmedQuery);
                                    }
                                }}
                            />
                        </div>
                        <div style={{ flex: "1 1 220px" }}>
                            <Forms.FormTitle tag="h3">Author ID (optional)</Forms.FormTitle>
                            <TextInput
                                value={authorId}
                                placeholder="Filter by author ID"
                                onChange={value => setAuthorId(String(value))}
                                onKeyDown={event => {
                                    if (event.key === "Enter") {
                                        void runSearch(false, trimmedQuery);
                                    }
                                }}
                            />
                        </div>
                        <div style={{ alignSelf: "flex-end" }}>
                            <Button
                                color={Button.Colors.BRAND}
                                onClick={() => {
                                    setDebouncedQuery(trimmedQuery);
                                    void runSearch(false, trimmedQuery);
                                }}
                                disabled={!canSearch || isLoading}
                            >
                                Search
                            </Button>
                        </div>
                    </div>

                    <TabBar
                        type="top"
                        look="brand"
                        className="vc-settings-tab-bar"
                        selectedItem={activeTab}
                        onItemSelect={(tab: SearchTab) => setActiveTab(tab)}
                    >
                        {TABS.map(tab => (
                            <TabBar.Item key={tab.id} className="vc-settings-tab-bar-item" id={tab.id}>
                                {tab.label}
                            </TabBar.Item>
                        ))}
                    </TabBar>

                    <ScrollerAuto style={{ maxHeight: "60vh", paddingRight: "8px" }}>
                        {isLoading && (
                            <Text variant="text-sm/normal" style={{ marginBottom: "16px" }}>
                                Loading results...
                            </Text>
                        )}

                        {error && (
                            <Text variant="text-sm/normal" style={{ marginBottom: "16px" }}>
                                {error}
                            </Text>
                        )}

                        {showEmptyState && (
                            <Text variant="text-sm/normal" style={{ marginBottom: "16px" }}>
                                No results found.
                            </Text>
                        )}

                        {!error && activeTab === "messages" && results.messages.map(message => (
                            <div
                                key={message.id}
                                onClick={() => navigateToMessage(message)}
                                role="button"
                                style={{
                                    display: "flex",
                                    gap: "12px",
                                    padding: "12px",
                                    borderRadius: "8px",
                                    background: "var(--background-secondary)",
                                    marginBottom: "10px",
                                    cursor: "pointer"
                                }}
                            >
                                <img
                                    src={getAvatarUrl(message.author)}
                                    width={36}
                                    height={36}
                                    style={{ borderRadius: "50%" }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                        <Text variant="text-sm/semibold">
                                            {message.author.global_name ?? message.author.username}
                                        </Text>
                                        <Timestamp timestamp={new Date(message.timestamp)} isInline={true} isEdited={false} />
                                    </div>
                                    <Text variant="text-sm/normal" style={{ marginTop: "4px" }}>
                                        {message.content || "No text content"}
                                    </Text>
                                </div>
                            </div>
                        ))}

                        {!error && activeTab === "media" && (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                                gap: "12px"
                            }}>
                                {mediaItems.map(item => {
                                    const url = item.attachment.proxy_url ?? item.attachment.url;
                                    if (!url) return null;
                                    const isVideo = isVideoAttachment(item.attachment);

                                    return (
                                        <div
                                            key={`${item.message.id}-${item.attachment.id}`}
                                            role="button"
                                            onClick={() => navigateToMessage(item.message)}
                                            style={{
                                                background: "var(--background-secondary)",
                                                borderRadius: "8px",
                                                overflow: "hidden",
                                                cursor: "pointer"
                                            }}
                                        >
                                            {isVideo ? (
                                                <video
                                                    src={url}
                                                    style={{ width: "100%", height: "160px", objectFit: "cover" }}
                                                    muted
                                                    controls
                                                    preload="metadata"
                                                />
                                            ) : (
                                                <img
                                                    src={url}
                                                    style={{ width: "100%", height: "160px", objectFit: "cover" }}
                                                />
                                            )}
                                            <div style={{ padding: "8px" }}>
                                                <Text variant="text-sm/normal">
                                                    {item.attachment.filename}
                                                </Text>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!error && activeTab === "files" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {fileItems.map(item => (
                                    <div
                                        key={`${item.message.id}-${item.attachment.id}`}
                                        role="button"
                                        onClick={() => navigateToMessage(item.message)}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "6px",
                                            padding: "12px",
                                            borderRadius: "8px",
                                            background: "var(--background-secondary)",
                                            cursor: "pointer"
                                        }}
                                    >
                                        <Text variant="text-sm/semibold">{item.attachment.filename}</Text>
                                        <Text variant="text-xs/normal">
                                            {formatBytes(item.attachment.size)}{item.attachment.content_type ? ` • ${item.attachment.content_type}` : ""}
                                        </Text>
                                        <Text variant="text-xs/normal">
                                            {item.message.author.global_name ?? item.message.author.username}
                                        </Text>
                                    </div>
                                ))}
                            </div>
                        )}

                        {results.cursor && !isLoading && !error && (
                            <div style={{ marginTop: "16px", textAlign: "center" }}>
                                <Button
                                    color={Button.Colors.BRAND}
                                    onClick={() => void runSearch(true)}
                                >
                                    Load more
                                </Button>
                            </div>
                        )}
                    </ScrollerAuto>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}
