<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { Upload, Save, X, RotateCcw, Loader2 } from 'lucide-vue-next';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';

const props = defineProps<{
  initialImage?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: { dataUrl: string; uploadedUrl?: string; uploadedPath?: string }): void;
}>();

const store = useAppStore()

const CROP_SIZE = 320;
const ZOOM_SPEED = 0.001;

const imageSrc = ref<string | null>(null);
const scale = ref(1);
const position = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const imgSize = ref({ width: 0, height: 0 });

const containerRef = ref<HTMLElement | null>(null);
const imgRef = ref<HTMLImageElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// 预上传相关状态
const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadedUrl = ref<string | null>(null);
const uploadedPath = ref<string | null>(null);
const uploadError = ref<string>('');

const minScale = computed(() => {
  if (imgSize.value.width > 0 && imgSize.value.height > 0) {
    return Math.max(CROP_SIZE / imgSize.value.width, CROP_SIZE / imgSize.value.height);
  }
  return 0.1;
});

const maxScale = computed(() => Math.max(minScale.value * 3, 3));

const getBoundedPosition = (x: number, y: number, currentScale: number, width: number, height: number) => {
  if (!width || !height) return { x, y };
  
  const imgRenderWidth = width * currentScale;
  const imgRenderHeight = height * currentScale;

  const xSlack = Math.max(0, (imgRenderWidth - CROP_SIZE) / 2);
  const ySlack = Math.max(0, (imgRenderHeight - CROP_SIZE) / 2);

  const xMin = -xSlack;
  const xMax = xSlack;
  const yMin = -ySlack;
  const yMax = ySlack;

  return {
    x: Math.max(xMin, Math.min(xMax, x)),
    y: Math.max(yMin, Math.min(yMax, y)),
  };
};

const adjustPositionForScale = (newScale: number) => {
    position.value = getBoundedPosition(
        position.value.x,
        position.value.y,
        newScale,
        imgSize.value.width,
        imgSize.value.height
    );
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  if (!imageSrc.value || !containerRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Position of the mouse inside the wrapper, from -1 to 1
  const mouseCX = (mouseX - CROP_SIZE / 2) / (CROP_SIZE / 2);
  const mouseCY = (mouseY - CROP_SIZE / 2) / (CROP_SIZE / 2);

  const currentScale = scale.value;
  const delta = -e.deltaY * ZOOM_SPEED;
  const newScale = Math.min(maxScale.value, Math.max(minScale.value, currentScale * (1 + delta)));

  const deltaScale = newScale - currentScale;

  // As the image scales, its center shifts. We need to counteract that shift
  // based on where the user is pointing, to keep that point under the cursor.
  const newX = position.value.x - mouseCX * (imgSize.value.width / 2) * deltaScale;
  const newY = position.value.y - mouseCY * (imgSize.value.height / 2) * deltaScale;

  scale.value = newScale;
  position.value = getBoundedPosition(newX, newY, newScale, imgSize.value.width, imgSize.value.height);
};

const handlePointerDown = (e: PointerEvent) => {
  if (!imageSrc.value) return;
  e.preventDefault();
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  };
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
};

const handlePointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return;
  e.preventDefault();
  const newX = e.clientX - dragStart.value.x;
  const newY = e.clientY - dragStart.value.y;
  position.value = getBoundedPosition(newX, newY, scale.value, imgSize.value.width, imgSize.value.height);
};

const handlePointerUp = (e: PointerEvent) => {
  if (!isDragging.value) return;
  isDragging.value = false;
  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
};

const onImageLoad = (e: Event) => {
  const img = e.target as HTMLImageElement;
  imgSize.value = { width: img.naturalWidth, height: img.naturalHeight };
  
  scale.value = minScale.value;
  position.value = { x: 0, y: 0 };
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      imageSrc.value = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input to allow re-uploading the same file
    target.value = '';
  }
};

const handleSave = async () => {
  if (!imageSrc.value || !imgRef.value) return;

  const canvas = document.createElement('canvas');
  canvas.width = CROP_SIZE;
  canvas.height = CROP_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // Translate context to center of canvas
  ctx.translate(CROP_SIZE / 2 + position.value.x, CROP_SIZE / 2 + position.value.y);
  ctx.scale(scale.value, scale.value);
  ctx.drawImage(imgRef.value, -imgSize.value.width / 2, -imgSize.value.height / 2);
  ctx.restore();

  // Use JPEG with 0.85 quality for smaller file size and faster upload
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  
  // 立即开始预上传
  await preUploadAvatar(dataUrl);
  
  emit('save', {
    dataUrl,
    uploadedUrl: uploadedUrl.value || undefined,
    uploadedPath: uploadedPath.value || undefined
  });
  emit('close');
};

// 预上传头像函数
const preUploadAvatar = async (dataUrl: string) => {
  if (!store.user) return;
  
  isUploading.value = true;
  uploadProgress.value = 0;
  uploadError.value = '';
  
  try {
    // 转换 dataURL 为 Blob
    const blob = dataURLtoBlob(dataUrl);
    if (!blob) {
      throw new Error('无效的图片格式');
    }
    
    const filePath = `${store.user.id}/avatar-${Date.now()}.jpg`;
    
    // 上传到 Supabase 存储
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
      });
    
    if (uploadError) {
      throw uploadError;
    }
    
    // 获取公开 URL
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    
    uploadedUrl.value = urlData.publicUrl;
    uploadedPath.value = filePath;
    uploadProgress.value = 100;
    
  } catch (error: any) {
    console.error('Avatar pre-upload failed:', error);
    uploadError.value = error.message || '上传失败';
  } finally {
    isUploading.value = false;
  }
};

// 数据URL转Blob的辅助函数
const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(',');
  if (arr.length < 2) return null;
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) return null;
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

onMounted(() => {
  const container = containerRef.value;
  if (container) {
    container.addEventListener('wheel', handleWheel, { passive: false });
  }
});

onUnmounted(() => {
  const container = containerRef.value;
  if (container) {
    container.removeEventListener('wheel', handleWheel);
  }
});

watch(scale, adjustPositionForScale);

watch(
  () => props.initialImage,
  (newVal) => {
    if (newVal) {
      imageSrc.value = newVal;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <header class="modal__header">
        <h2>更换头像</h2>
        <button class="icon-btn" @click="emit('close')"><X :size="20" /></button>
      </header>

      <main class="cropper-body">
        <div
          class="cropper-wrapper"
          ref="containerRef"
          :class="{ 'is-dragging': isDragging, 'has-image': imageSrc }"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
        >
          <template v-if="imageSrc">
            <img
              ref="imgRef"
              :src="imageSrc"
              alt="Avatar"
              class="cropper-image"
              :style="{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }"
              @load="onImageLoad"
            />
          </template>
          <div v-else class="upload-prompt" @click.stop="triggerFileInput">
            <Upload :size="40" />
            <span>点击选择图片</span>
          </div>

          <!-- Visual Circle Overlay -->
          <div class="circle-overlay" v-if="imageSrc"></div>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="onFileChange"
        />

        <div class="controls" v-if="imageSrc">
            <input
              type="range"
              :min="minScale"
              :max="maxScale"
              step="0.001"
              v-model.number="scale"
              class="slider"
            />
        </div>

        <div class="actions">
          <button class="btn" @click="triggerFileInput">
            <RotateCcw :size="16" />
            {{ imageSrc ? '更换图片' : '选择图片' }}
          </button>
          <button
            @click="handleSave"
            class="btn btn--primary"
            :disabled="!imageSrc || isUploading"
          >
            <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
            <Save v-else :size="16" />
            {{ isUploading ? `上传中 ${uploadProgress}%` : '保存头像' }}
          </button>
        </div>
        
        <!-- 上传错误提示 -->
        <div v-if="uploadError" class="upload-error">
          <p class="error-text">{{ uploadError }}</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.cropper-body {
  display: grid;
  gap: 16px;
  padding: 8px 0;
}

.cropper-wrapper {
  height: 320px;
  width: 320px;
  margin: 0 auto;
  background: #e2e8f0;
  overflow: hidden;
  position: relative;
  user-select: none;
}
.cropper-wrapper.has-image {
  cursor: grab;
  background: #222;
}
.cropper-wrapper.is-dragging {
  cursor: grabbing;
}

.cropper-image {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  will-change: transform;
  pointer-events: none;
  max-width: none;
  margin-top: calc(v-bind("-imgSize.height / 2") * 1px);
  margin-left: calc(v-bind("-imgSize.width / 2") * 1px);
}

.upload-prompt {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.upload-prompt:hover {
  background-color: #d1d5db;
}

.circle-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.controls {
  padding: 0 16px;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  outline: none;
  opacity: 0.9;
  transition: opacity .2s;
}
.slider:hover {
  opacity: 1;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--accent);
  cursor: pointer;
  border-radius: 50%;
}
.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--accent);
  cursor: pointer;
  border-radius: 50%;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.upload-error {
  text-align: center;
  margin-top: 8px;
}

.error-text {
  color: var(--danger);
  font-size: 0.9rem;
  margin: 0;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>