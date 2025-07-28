// 用于前端和原生通信的桥接文件
// Bridge.js - 连接 foliate-js 和 iOS 原生应用

(function() {
    'use strict';
    
    // 全局变量
    let reader = null;
    let currentBook = null;
    let isInitialized = false;
    
    // 消息处理器映射
    const messageHandlers = new Map();
    
    // 初始化函数
    function initialize() {
        console.log('Bridge.js: 初始化开始');
        
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupBridge);
        } else {
            setupBridge();
        }
    }
    
    // 设置桥接
    function setupBridge() {
        console.log('Bridge.js: 设置桥接');
        
        // 检查是否在 WebView 环境中
        if (typeof window.webkit === 'undefined' || !window.webkit.messageHandlers) {
            console.warn('Bridge.js: 不在 WebView 环境中，跳过桥接设置');
            return;
        }
        
        // 设置全局函数供外部调用
        window.openBook = openBook;
        window.getReader = getReader;
        window.setAppearance = setAppearance;
        window.getTableOfContents = getTableOfContents;
        window.navigateToLocation = navigateToLocation;
        window.getCurrentLocation = getCurrentLocation;
        window.searchText = searchText;
        window.addAnnotation = addAnnotation;
        window.removeAnnotation = removeAnnotation;
        window.getAnnotations = getAnnotations;
        window.setTheme = setTheme;
        window.setFontSize = setFontSize;
        window.setFontFamily = setFontFamily;
        window.setLineHeight = setLineHeight;
        window.setLetterSpacing = setLetterSpacing;
        window.enableAnimation = enableAnimation;
        window.showStatusBar = showStatusBar;
        
        // 发送就绪消息
        sendMessage('ready', {});
        
        console.log('Bridge.js: 桥接设置完成');
    }
    
    // 打开书籍
    async function openBook(file) {
        try {
            console.log('Bridge.js: 开始打开书籍', file.name, file.size);
            
            // 检查文件类型
            if (!file || !file.size) {
                throw new Error('无效的文件');
            }
            
            // 创建 foliate 视图
            if (!reader) {
                await createReader();
            }
            
            // 使用 foliate-js 打开书籍
            currentBook = await window.makeBook(file);
            await reader.open(currentBook);
            
            console.log('Bridge.js: 书籍打开成功');
            
            // 发送书籍就绪消息
            sendMessage('book-ready', {
                title: currentBook.metadata?.title || file.name,
                author: currentBook.metadata?.creator || 'Unknown',
                language: currentBook.metadata?.language || 'en',
                totalPages: currentBook.sections?.length || 0
            });
            
            // 设置事件监听器
            setupEventListeners();
            
            return true;
        } catch (error) {
            console.error('Bridge.js: 打开书籍失败', error);
            sendMessage('book-error', {
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    // 创建阅读器实例
    async function createReader() {
        try {
            console.log('Bridge.js: 创建阅读器实例');
            
            // 创建 foliate-view 元素
            const viewElement = document.createElement('foliate-view');
            viewElement.setAttribute('exportparts', 'head,foot,filter');
            
            // 添加到页面
            document.body.appendChild(viewElement);
            
            // 等待自定义元素定义（虽然我们已经检查过了，但为了安全起见）
            await customElements.whenDefined('foliate-view');
            
            reader = viewElement;
            
            console.log('Bridge.js: 阅读器实例创建成功');
            return reader;
        } catch (error) {
            console.error('Bridge.js: 创建阅读器实例失败', error);
            throw error;
        }
    }
    
    // 设置事件监听器
    function setupEventListeners() {
        if (!reader) return;
        
        console.log('Bridge.js: 设置事件监听器');
        
        // 监听位置变化事件
        reader.addEventListener('relocate', (event) => {
            const location = event.detail;
            console.log('Bridge.js: 位置变化', location);
            
            sendMessage('relocate', {
                location: {
                    current: location.index || 0,
                    total: currentBook?.sections?.length || 0,
                    fraction: location.fraction || 0,
                    cfi: location.cfi || '',
                    tocItem: location.tocItem || null,
                    pageItem: location.pageItem || null
                }
            });
        });
        
        // 监听加载事件
        reader.addEventListener('load', (event) => {
            console.log('Bridge.js: 内容加载', event.detail);
            sendMessage('content-loaded', event.detail);
        });
        
        // 监听外部链接事件
        reader.addEventListener('external-link', (event) => {
            console.log('Bridge.js: 外部链接', event.detail);
            sendMessage('external-link', event.detail);
        });
        
        // 监听注释事件
        reader.addEventListener('show-annotation', (event) => {
            console.log('Bridge.js: 显示注释', event.detail);
            sendMessage('show-annotation', event.detail);
        });
        
        // 监听绘制注释事件
        reader.addEventListener('draw-annotation', (event) => {
            console.log('Bridge.js: 绘制注释', event.detail);
            sendMessage('draw-annotation', event.detail);
        });
        
        // 监听创建覆盖层事件
        reader.addEventListener('create-overlay', (event) => {
            console.log('Bridge.js: 创建覆盖层', event.detail);
            sendMessage('create-overlay', event.detail);
        });
    }
    
    // 获取阅读器实例
    function getReader() {
        return reader;
    }
    
    // 设置外观
    function setAppearance(settings) {
        if (!reader) {
            console.warn('Bridge.js: 阅读器未初始化');
            return false;
        }
        
        try {
            console.log('Bridge.js: 设置外观', settings);
            
            // 应用样式设置
            if (settings.style) {
                applyStyleSettings(settings.style);
            }
            
            // 应用布局设置
            if (settings.layout) {
                applyLayoutSettings(settings.layout);
            }
            
            sendMessage('appearance-changed', settings);
            return true;
        } catch (error) {
            console.error('Bridge.js: 设置外观失败', error);
            return false;
        }
    }
    
    // 应用样式设置
    function applyStyleSettings(style) {
        const styleElement = document.getElementById('foliate-custom-styles') || 
                           document.createElement('style');
        
        if (!styleElement.id) {
            styleElement.id = 'foliate-custom-styles';
            document.head.appendChild(styleElement);
        }
        
        let css = '';
        
        // 字体设置
        if (style.fontFamily) {
            css += `html, body { font-family: ${style.fontFamily} !important; }`;
        }
        
        if (style.fontSize) {
            css += `html, body { font-size: ${style.fontSize}px !important; }`;
        }
        
        // 行高设置
        if (style.lineHeight) {
            css += `p, div, span { line-height: ${style.lineHeight} !important; }`;
        }
        
        // 字间距设置
        if (style.letterSpacing) {
            css += `p, div, span { letter-spacing: ${style.letterSpacing}em !important; }`;
        }
        
        // 主题设置
        if (style.theme) {
            applyTheme(style.theme);
        }
        
        // 用户样式表
        if (style.userStylesheet) {
            css += style.userStylesheet;
        }
        
        styleElement.textContent = css;
    }
    
    // 应用布局设置
    function applyLayoutSettings(layout) {
        if (!reader) return;
        
        // 这里可以应用布局相关的设置
        // 例如分页、列数、间距等
        console.log('Bridge.js: 应用布局设置', layout);
    }
    
    // 应用主题
    function applyTheme(theme) {
        const root = document.documentElement;
        
        // 移除现有主题类
        root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
        
        // 添加新主题类
        if (theme === 'dark') {
            root.classList.add('theme-dark');
        } else if (theme === 'sepia') {
            root.classList.add('theme-sepia');
        } else {
            root.classList.add('theme-light');
        }
        
        // 设置CSS变量
        const themeColors = getThemeColors(theme);
        Object.entries(themeColors).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
        });
    }
    
    // 获取主题颜色
    function getThemeColors(theme) {
        const themes = {
            light: {
                'bg-color': '#ffffff',
                'text-color': '#000000',
                'link-color': '#0066cc'
            },
            dark: {
                'bg-color': '#1e1e1e',
                'text-color': '#ffffff',
                'link-color': '#4db8ff'
            },
            sepia: {
                'bg-color': '#f4f1e8',
                'text-color': '#5c4b37',
                'link-color': '#8b4513'
            }
        };
        
        return themes[theme] || themes.light;
    }
    
    // 获取目录
    function getTableOfContents() {
        if (!currentBook || !currentBook.toc) {
            return [];
        }
        
        return currentBook.toc;
    }
    
    // 导航到指定位置
    function navigateToLocation(target) {
        if (!reader) {
            console.warn('Bridge.js: 阅读器未初始化');
            return false;
        }
        
        try {
            console.log('Bridge.js: 导航到位置', target);
            reader.goTo(target);
            return true;
        } catch (error) {
            console.error('Bridge.js: 导航失败', error);
            return false;
        }
    }
    
    // 获取当前位置
    function getCurrentLocation() {
        if (!reader) {
            return null;
        }
        
        return {
            index: reader.lastLocation?.index || 0,
            fraction: reader.lastLocation?.fraction || 0,
            cfi: reader.lastLocation?.cfi || '',
            tocItem: reader.lastLocation?.tocItem || null,
            pageItem: reader.lastLocation?.pageItem || null
        };
    }
    
    // 搜索文本
    async function searchText(query, options = {}) {
        if (!reader) {
            console.warn('Bridge.js: 阅读器未初始化');
            return [];
        }
        
        try {
            console.log('Bridge.js: 搜索文本', query);
            
            const results = [];
            for await (const result of reader.search({ query, ...options })) {
                if (result.subitems) {
                    results.push(result);
                }
            }
            
            sendMessage('search-completed', { query, results });
            return results;
        } catch (error) {
            console.error('Bridge.js: 搜索失败', error);
            return [];
        }
    }
    
    // 添加注释
    function addAnnotation(annotation) {
        if (!reader) {
            console.warn('Bridge.js: 阅读器未初始化');
            return false;
        }
        
        try {
            console.log('Bridge.js: 添加注释', annotation);
            reader.addAnnotation(annotation);
            return true;
        } catch (error) {
            console.error('Bridge.js: 添加注释失败', error);
            return false;
        }
    }
    
    // 移除注释
    function removeAnnotation(annotation) {
        if (!reader) {
            console.warn('Bridge.js: 阅读器未初始化');
            return false;
        }
        
        try {
            console.log('Bridge.js: 移除注释', annotation);
            reader.deleteAnnotation(annotation);
            return true;
        } catch (error) {
            console.error('Bridge.js: 移除注释失败', error);
            return false;
        }
    }
    
    // 获取注释
    function getAnnotations() {
        if (!reader) {
            return [];
        }
        
        // 这里需要根据实际的注释存储方式来实现
        return [];
    }
    
    // 设置主题
    function setTheme(theme) {
        return setAppearance({ style: { theme } });
    }
    
    // 设置字体大小
    function setFontSize(size) {
        return setAppearance({ style: { fontSize: size } });
    }
    
    // 设置字体族
    function setFontFamily(family) {
        return setAppearance({ style: { fontFamily: family } });
    }
    
    // 设置行高
    function setLineHeight(height) {
        return setAppearance({ style: { lineHeight: height } });
    }
    
    // 设置字间距
    function setLetterSpacing(spacing) {
        return setAppearance({ style: { letterSpacing: spacing } });
    }
    
    // 启用/禁用动画
    function enableAnimation(enabled) {
        return setAppearance({ layout: { animated: enabled } });
    }
    
    // 显示/隐藏状态栏
    function showStatusBar(show) {
        sendMessage('status-bar-changed', { show });
        return true;
    }
    
    // 发送消息到原生应用
    function sendMessage(type, data) {
        if (typeof window.webkit === 'undefined' || !window.webkit.messageHandlers) {
            console.warn('Bridge.js: 无法发送消息，不在 WebView 环境中');
            return;
        }
        
        try {
            const message = {
                type: type,
                data: data,
                timestamp: Date.now()
            };
            
            window.webkit.messageHandlers.viewer.postMessage(JSON.stringify(message));
        } catch (error) {
            console.error('Bridge.js: 发送消息失败', error);
        }
    }
    
    // 注册消息处理器
    function registerMessageHandler(type, handler) {
        messageHandlers.set(type, handler);
    }
    
    // 处理来自原生应用的消息
    function handleNativeMessage(message) {
        try {
            const { type, data } = JSON.parse(message);
            const handler = messageHandlers.get(type);
            
            if (handler) {
                handler(data);
            } else {
                console.warn('Bridge.js: 未找到消息处理器', type);
            }
        } catch (error) {
            console.error('Bridge.js: 处理原生消息失败', error);
        }
    }
    
    // 暴露全局函数
    window.bridge = {
        initialize,
        openBook,
        getReader,
        setAppearance,
        getTableOfContents,
        navigateToLocation,
        getCurrentLocation,
        searchText,
        addAnnotation,
        removeAnnotation,
        getAnnotations,
        setTheme,
        setFontSize,
        setFontFamily,
        setLineHeight,
        setLetterSpacing,
        enableAnimation,
        showStatusBar,
        registerMessageHandler,
        handleNativeMessage
    };
    
    // 等待 foliate-js 加载完成
    function waitForFoliateJS() {
        console.log('Bridge.js: 检查 foliate-js 加载状态...');
        console.log('window.makeBook:', typeof window.makeBook);
        console.log('foliate-view element:', typeof customElements.get('foliate-view'));
        
        if (typeof window.makeBook !== 'undefined' && 
            typeof customElements.get('foliate-view') !== 'undefined') {
            console.log('Bridge.js: foliate-js 已加载，开始初始化');
            initialize();
        } else {
            console.log('Bridge.js: 等待 foliate-js 加载...');
            // 设置超时机制，最多等待10秒
            if (!window.foliateWaitTimeout) {
                window.foliateWaitTimeout = setTimeout(() => {
                    console.error('Bridge.js: foliate-js 加载超时');
                    sendMessage('foliate-timeout', {
                        message: 'foliate-js 加载超时，请检查网络连接'
                    });
                }, 10000);
            }
            setTimeout(waitForFoliateJS, 100);
        }
    }
    
    // 启动延迟初始化
    waitForFoliateJS();
    
    // 导出模块（如果使用ES6模块）
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window.bridge;
    }
    
    console.log('Bridge.js: 模块加载完成，等待 foliate-js...');
})();
