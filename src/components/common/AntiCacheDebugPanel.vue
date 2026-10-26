<template>
  <!-- 🔴 生产环境整块不渲染：调试面板绝不能泄露到线上（isDev 生产构建为 false，
       整棵子树被 tree-shake）。 -->
  <div v-if="isDev && visible" class="debug-panel">
    <div class="debug-header">
      <h3>🔧 防缓存调试面板</h3>
      <button @click="togglePanel" class="close-btn" title="关闭面板">
        ×
      </button>
    </div>

    <div class="debug-content">
      <div class="debug-item">
        <strong>防缓存戳:</strong>
        <code class="rnd-value" :title="rnd">{{ rnd }}</code>
        <button @click="refresh" class="refresh-btn">
          刷新
        </button>
      </div>

      <div class="debug-item">
        <strong>最后刷新:</strong>
        <code>{{ formattedLastRefreshed }}</code>
      </div>

      <div class="debug-item">
        <strong>刷新次数:</strong>
        <code>{{ refreshCount }}</code>
      </div>

      <div class="debug-item">
        <strong>自动刷新:</strong>
        <code>{{ autoRefreshStatus }}</code>
      </div>

      <div class="debug-item">
        <strong>刷新间隔:</strong>
        <code>{{ formatInterval(refreshInterval) }}</code>
      </div>

      <div class="debug-actions">
        <button
          @click="copyRnd"
          class="action-btn secondary"
          title="复制防缓存戳"
        >
          📋 复制
        </button>
      </div>

      <div class="debug-info">
        <details>
          <summary>📊 详细信息</summary>
          <pre>{{ JSON.stringify(debugInfo, null, 2) }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAntiCache } from '@/composables/useAntiCache';

/**
 * 生产环境隔离：调试面板只在 dev 构建渲染。
 * 用 `import.meta.env.DEV` 在 script 里取一次成常量（模板表达式里不能直接用
 * `import.meta` —— Vue 模板按非 module 模式解析会报 `import.meta may appear only
 * with 'sourceType: "module"'`）。生产构建时 Vite 会把 `import.meta.env.DEV` 替换成
 * `false`，`v-if="isDev && visible"` 整棵子树被 tree-shake，不泄露调试信息。
 */
const isDev = import.meta.env.DEV;

interface Props {
  /** 是否显示面板 */
  visible?: boolean;
  /** 自动刷新间隔（毫秒） */
  refreshInterval?: number;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  refreshInterval: 5 * 60 * 1000
});

const emit = defineEmits<Emits>();

// 防缓存功能
const {
  rnd,
  refresh: refreshRnd,
  formattedLastRefreshed,
  debugInfo,
  refreshCount,
  isAutoRefreshing
} = useAntiCache({
  autoRefresh: props.visible,
  refreshInterval: props.refreshInterval,
  enableDebug: true
});

// 计算属性
const autoRefresh = computed(() => isAutoRefreshing.value);

const autoRefreshStatus = computed(() => {
  if (!autoRefresh.value) return '关闭';
  return `开启 (${formatInterval(props.refreshInterval)})`;
});

// 方法
const refresh = () => {
  refreshRnd();
};

const togglePanel = () => {
  emit('update:visible', false);
};

const copyRnd = async (evt: MouseEvent) => {
  try {
    // 首先尝试使用 Clipboard API
    await navigator.clipboard.writeText(rnd.value);
    // 这里可以添加一个提示
    const btn = evt.currentTarget as HTMLButtonElement;
    const originalText = btn.textContent || '📋 复制';
    btn.textContent = '✓ 已复制';
    btn.classList.add('copied');

    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Clipboard API 复制失败，尝试降级方案:', err);

    // 降级方案：使用 createRange 和 execCommand
    try {
      const textArea = document.createElement('textarea');
      textArea.value = rnd.value;
      textArea.style.position = 'fixed'; // 防止页面滚动
      textArea.style.opacity = '0'; // 透明
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        const btn = evt.currentTarget as HTMLButtonElement;
        const originalText = btn.textContent || '📋 复制';
        btn.textContent = '✓ 已复制';
        btn.classList.add('copied');

        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
        console.warn('使用降级方案复制成功');
      } else {
        throw new Error('execCommand 复制失败', { cause: err });
      }
    } catch (fallbackErr) {
      console.error('降级方案也失败:', fallbackErr);
      // 最终降级：提示用户手动复制
      alert('请手动复制以下值：' + rnd.value);
    }
  }
};

const formatInterval = (ms: number) => {
  if (ms < 60000) return `${ms}ms`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`;
  return `${Math.round(ms / 3600000)}小时`;
};

// 暴露方法给父组件
defineExpose({
  refresh,
  copyRnd
});
</script>

<style scoped>
.debug-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  z-index: 9999;
  width: 320px;
  max-height: 500px;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #67c23a;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.debug-content {
  padding: 16px;
}

.debug-item {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.debug-item:last-child {
  margin-bottom: 0;
}

.debug-item strong {
  color: #a0d911;
  font-weight: 500;
}

.debug-item code {
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  flex: 1;
  margin: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.rnd-value {
  max-width: 120px;
}

.refresh-btn {
  background: #409eff;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  white-space: nowrap;
}

.refresh-btn:hover {
  background: #66b1ff;
  transform: translateY(-1px);
}

.refresh-btn:active {
  background: #3a8ee6;
  transform: translateY(0);
}

.debug-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  background: #67c23a;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  flex: 1;
  min-width: 120px;
}

.action-btn:hover {
  background: #85ce61;
  transform: translateY(-1px);
}

.action-btn.active {
  background: #e6a23c;
}

.action-btn.active:hover {
  background: #ebb563;
}

.action-btn.secondary {
  background: #606266;
}

.action-btn.secondary:hover {
  background: #797d82;
}

.action-btn.copied {
  background: #67c23a;
}

.debug-info {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-info details {
  cursor: pointer;
}

.debug-info summary {
  color: #a0d911;
  font-weight: 500;
  margin-bottom: 8px;
}

.debug-info pre {
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: 6px;
  font-size: 11px;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 滚动条样式 */
.debug-panel::-webkit-scrollbar {
  width: 6px;
}

.debug-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.debug-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.debug-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 动画 */
.debug-panel {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>