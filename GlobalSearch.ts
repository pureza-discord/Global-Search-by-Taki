// Vencord, a Discord client mod
// Copyright (c) 2026 Taki
// SPDX-License-Identifier: GPL-3.0-or-later

import definePlugin from "@utils/types";
import { findByProps } from "@webpack";
import { openModal } from "@utils/modal";
import { React, showToast } from "@webpack/common";

interface SearchTabResult {
    messages: any[][];
    channels: any[];
    cursor?: { type: string; timestamp?: string };
    total_results: number;
    time_spent_ms: number;
}

interface TabData {
    messages: any[];
    cursor?: any;
    total_results: number;
}

const GlobalSearch = definePlugin({
    name: "GlobalSearch",
    description: "Sistema de busca global avançado (mensagens, mídia e arquivos) em DMs/grupos com filtro por autor, paginação e navegação direta.",
    authors: [{ name: "Taki", id: BigInt("0") }], // Substitua pelo seu ID real se quiser
    tags: ["search", "global", "media", "files"],

    renderChatBarButton: () => {
        const Tooltip = findByProps("Tooltip")?.Tooltip;
        const SearchIcon = findByProps("SearchIcon")?.SearchIcon || (() => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);

        return (
            <Tooltip text="Global Search" position="top">
                {(props: any) => (
                    <div
                        {...props}
                        className="vc-chatbar-button"
                        style={{ cursor: "pointer", marginRight: "8px" }}
                        onClick={() => openModal((modalProps: any) => <GlobalSearchModal {...modalProps} />)}
                    >
                        <SearchIcon width={24} height={24} />
                    </div>
                )}
            </Tooltip>
        );
    }
});

export default GlobalSearch;

// ======================== MODAL COMPONENT ========================

const GlobalSearchModal: React.FC<any> = (modalProps) => {
    const [query, setQuery] = React.useState("");
    const [authorId, setAuthorId] = React.useState("");
    const [activeTab, setActiveTab] = React.useState<"messages" | "media" | "files">("messages");
    const [tabData, setTabData] = React.useState<Record<string, TabData>>({});
    const [cursors, setCursors] = React.useState<Record<string, any>>({});
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");

    const UserStore = findByProps("getCurrentUser");
    const currentUserId = UserStore?.getCurrentUser()?.id;

    const RestAPI = findByProps("post", "get") as any;
    const { transitionToChannel } = findByProps("transitionToChannel") as any;
    const { jumpToMessage } = findByProps("jumpToMessage") as any;

    const ModalRoot = findByProps("ModalRoot")?.ModalRoot;
    const ModalHeader = findByProps("ModalHeader")?.ModalHeader;
    const ModalContent = findByProps("ModalContent")?.ModalContent;
    const ModalFooter = findByProps("ModalFooter")?.ModalFooter;
    const ModalCloseButton = findByProps("ModalCloseButton")?.ModalCloseButton;
    const Button = findByProps("Button")?.Button;
    const TextInput = findByProps("TextInput")?.TextInput;
    const Spinner = findByProps("Spinner")?.Spinner;
    const Tabs = findByProps("Tabs")?.Tabs;
    const TabBar = findByProps("TabBar")?.TabBar || Tabs?.TabBar;
    const Avatar = findByProps("Avatar")?.Avatar;
    const Timestamp = findByProps("Timestamp")?.Timestamp;

    const performSearch = async (overrideCursors: Record<string, any> = {}) => {
        if (!query.trim() && !authorId) {
            showToast("Digite um termo ou selecione um autor", { type: "error" });
            return;
        }

        setLoading(true);
        setError("");

        const tabsPayload: Record<string, any> = {};

        const baseConfig = {
            sort_by: "timestamp" as const,
            sort_order: "desc" as const,
            limit: 25,
            content: query.trim() || undefined,
            author_id: authorId ? [authorId] : undefined
        };

        tabsPayload.messages = { ...baseConfig, cursor: overrideCursors.messages ?? null };
        tabsPayload.media = {
            ...baseConfig,
            has: ["image", "video"],
            cursor: overrideCursors.media ?? null
        };
        tabsPayload.files = {
            ...baseConfig,
            has: ["file"],
            cursor: overrideCursors.files ?? null
        };

        const payload = {
            tabs: tabsPayload,
            track_exact_total_hits: false
        };

        try {
            const response = await RestAPI.post({
                url: "/users/@me/messages/search/tabs",
                body: payload
            });

            const newTabData: Record<string, TabData> = { ...tabData };
            const newCursors: Record<string, any> = { ...cursors };

            Object.keys(tabsPayload).forEach((tabKey) => {
                const data = response.body.tabs?.[tabKey] as SearchTabResult | undefined;
                if (!data) return;

                const flatMessages = data.messages.flat();

                newTabData[tabKey] = {
                    messages: (newTabData[tabKey]?.messages || []).concat(flatMessages),
                    cursor: data.cursor,
                    total_results: data.total_results
                };
                newCursors[tabKey] = data.cursor;
            });

            setTabData(newTabData);
            setCursors(newCursors);
        } catch (err: any) {
            setError(err?.message || "Erro desconhecido na busca. Verifique rate limits.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setTabData({});
        setCursors({});
        performSearch({});
    };

    const loadMore = (tab: string) => {
        const currentCursor = cursors[tab];
        if (!currentCursor || loading) return;

        const override: Record<string, any> = {};
        override[tab] = currentCursor;
        performSearch(override);
    };

    const navigateToMessage = (channelId: string, messageId: string) => {
        if (!transitionToChannel || !jumpToMessage) {
            showToast("Erro ao navegar (módulo não encontrado)", { type: "error" });
            return;
        }

        transitionToChannel(channelId);
        setTimeout(() => {
            jumpToMessage(channelId, messageId, true);
            modalProps.onClose();
        }, 150);
    };

    const renderResult = (msg: any) => {
        const author = msg.author;
        const hasMedia = msg.attachments?.some((a: any) => a.content_type?.startsWith("image") || a.content_type?.startsWith("video")) ||
                        msg.embeds?.some((e: any) => e.type === "image" || e.type === "video" || e.type === "gifv");

        return (
            <div
                key={msg.id}
                onClick={() => navigateToMessage(msg.channel_id, msg.id)}
                style={{
                    display: "flex",
                    padding: "12px",
                    marginBottom: "8px",
                    background: "var(--background-secondary)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    gap: "12px",
                    alignItems: "flex-start"
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "var(--background-tertiary)"}
                onMouseOut={(e) => e.currentTarget.style.background = "var(--background-secondary)"}
            >
                <Avatar src={author.avatar ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` : undefined} size="SIZE_40" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: "600", color: "var(--header-primary)" }}>{author.global_name || author.username}</span>
                        {Timestamp && <Timestamp timestamp={new Date(msg.timestamp)} />}
                    </div>
                    <div style={{ color: "var(--text-normal)", wordBreak: "break-word", marginBottom: "8px" }}>
                        {msg.content || (hasMedia ? "[Mídia]" : "[Sem conteúdo de texto]")}
                    </div>
                    {msg.attachments?.length > 0 && (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {msg.attachments.slice(0, 3).map((att: any, i: number) => (
                                <img key={i} src={att.url} alt="" style={{ maxHeight: "120px", borderRadius: "4px", maxWidth: "200px" }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const currentResults = tabData[activeTab]?.messages || [];
    const hasMore = !!cursors[activeTab];

    return (
        <ModalRoot size="large" {...modalProps}>
            <ModalHeader>
                <div style={{ fontSize: "20px", fontWeight: "600" }}>Global Search</div>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent style={{ padding: "20px" }}>
                <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                    <TextInput
                        value={query}
                        onChange={(v: string) => setQuery(v)}
                        placeholder="Busque por texto, palavra-chave ou frase..."
                        style={{ flex: 1 }}
                    />
                    <TextInput
                        value={authorId}
                        onChange={(v: string) => setAuthorId(v)}
                        placeholder="ID do autor (opcional)"
                        style={{ width: "220px" }}
                    />
                    <Button
                        onClick={() => currentUserId && setAuthorId(currentUserId)}
                        color={Button.Colors.PRIMARY}
                    >
                        Eu
                    </Button>
                    <Button
                        onClick={handleSearch}
                        color={Button.Colors.GREEN}
                        disabled={loading}
                    >
                        {loading ? <Spinner type="pulsingEllipsis" /> : "Buscar"}
                    </Button>
                </div>

                {error && <div style={{ color: "var(--text-danger)", marginBottom: "16px" }}>{error}</div>}

                <TabBar
                    selectedItem={activeTab}
                    onItemSelect={(tab: any) => setActiveTab(tab)}
                    type="top"
                    look="brand"
                >
                    <TabBar.Item id="messages">Mensagens</TabBar.Item>
                    <TabBar.Item id="media">Mídia</TabBar.Item>
                    <TabBar.Item id="files">Arquivos</TabBar.Item>
                </TabBar>

                <div style={{ marginTop: "20px", maxHeight: "calc(80vh - 280px)", overflowY: "auto" }}>
                    {loading && !currentResults.length ? (
                        <div style={{ textAlign: "center", padding: "40px" }}><Spinner type="spinningCircle" /></div>
                    ) : currentResults.length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px" }}>
                            Nenhum resultado encontrado.
                        </div>
                    ) : (
                        currentResults.map(renderResult)
                    )}

                    {hasMore && (
                        <div style={{ textAlign: "center", margin: "20px 0" }}>
                            <Button
                                onClick={() => loadMore(activeTab)}
                                disabled={loading}
                                color={Button.Colors.PRIMARY}
                            >
                                {loading ? "Carregando..." : "Carregar mais"}
                            </Button>
                        </div>
                    )}
                </div>
            </ModalContent>

            <ModalFooter>
                <Button onClick={modalProps.onClose} color={Button.Colors.PRIMARY} look={Button.Looks.LINK}>
                    Fechar
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
};