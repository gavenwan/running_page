import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Layout from '@/components/Layout';

// ============ 数据类型 ============
export interface TravelPlace {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  status: 'wishlist' | 'visited'; // wishlist=想去(红), visited=去过(绿)
  photos: string[];
  blogUrl?: string;
  visitDate?: string;
  createdAt: string;
}

const STORAGE_KEY = 'travel_places';

const loadPlaces = (): TravelPlace[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const savePlaces = (places: TravelPlace[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
};

// ============ MapLibre 地图瓦片样式（CARTO 免费底图，中文 OR OpenFreeMap） ============
// 多个免费可用的地图样式（按优先级）
const MAP_STYLES = {
  // OpenFreeMap - 免费, 无需API Key, 支持中文标注
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  // CARTO - 免费, 无需API Key
  cartoDark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  cartoLight: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};

// ============ SVG 图标生成 ============
const createPinSVG = (color: string, innerColor: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <circle cx="14" cy="13" r="11" fill="${color}" stroke="white" stroke-width="2.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
  <circle cx="14" cy="13" r="5" fill="${innerColor}"/>
  <path d="M14 24 Q14 34 14 34" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const createFlagSVG = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <rect x="7" y="2" width="2.5" height="32" fill="#15803d" rx="1.2"/>
  <polygon points="9.5,2 26,8 9.5,15" fill="#22c55e" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.2))"/>
</svg>`;

const svgToDataUrl = (svg: string) =>
  'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

// ============ 地点添加/编辑弹窗 ============
interface PlaceModalProps {
  place: Partial<TravelPlace> | null;
  onSave: (place: TravelPlace) => void;
  onClose: () => void;
}

const PlaceModal: React.FC<PlaceModalProps> = ({ place, onSave, onClose }) => {
  const [name, setName] = useState(place?.name ?? '');
  const [description, setDescription] = useState(place?.description ?? '');
  const [status, setStatus] = useState<'wishlist' | 'visited'>(place?.status ?? 'wishlist');
  const [blogUrl, setBlogUrl] = useState(place?.blogUrl ?? '');
  const [visitDate, setVisitDate] = useState(place?.visitDate ?? '');
  const [photos, setPhotos] = useState<string[]>(place?.photos ?? []);
  const [photoInput, setPhotoInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAddPhotoUrl = () => {
    if (photoInput.trim()) {
      setPhotos((p) => [...p, photoInput.trim()]);
      setPhotoInput('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) setPhotos((p) => [...p, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: place?.id ?? `place_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      lat: place?.lat ?? 0,
      lng: place?.lng ?? 0,
      status,
      photos,
      blogUrl: blogUrl.trim() || undefined,
      visitDate: status === 'visited' ? visitDate.trim() || undefined : undefined,
      createdAt: place?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{
          background: 'var(--bg-color,#fff)',
          color: 'var(--text-color,#222)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-2xl font-bold opacity-50 hover:opacity-90"
        >
          ×
        </button>

        <h2 className="mb-5 text-lg font-bold">
          {place?.id ? '✏️ 编辑地点' : '📌 添加新地点'}
        </h2>

        {/* 名称 */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-semibold">地点名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ background: 'var(--input-bg,#f5f5f5)', borderColor: 'var(--border,#ddd)', color: 'inherit' }}
            placeholder="例：京都 / 张家界"
            autoFocus
          />
        </div>

        {/* 描述 */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-semibold">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ background: 'var(--input-bg,#f5f5f5)', borderColor: 'var(--border,#ddd)', color: 'inherit' }}
            rows={2}
            placeholder="关于这个地方..."
          />
        </div>

        {/* 状态 */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-semibold">状态</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" value="wishlist" checked={status === 'wishlist'} onChange={() => setStatus('wishlist')} />
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              <span className="text-sm">想去</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" value="visited" checked={status === 'visited'} onChange={() => setStatus('visited')} />
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm">去过了</span>
            </label>
          </div>
        </div>

        {/* 到访日期 */}
        {status === 'visited' && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-semibold">到访日期</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ background: 'var(--input-bg,#f5f5f5)', borderColor: 'var(--border,#ddd)', color: 'inherit' }}
            />
          </div>
        )}

        {/* 博文链接 */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-semibold">博文链接</label>
          <input
            type="url"
            value={blogUrl}
            onChange={(e) => setBlogUrl(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ background: 'var(--input-bg,#f5f5f5)', borderColor: 'var(--border,#ddd)', color: 'inherit' }}
            placeholder="https://blog.wenxiaowan.com/..."
          />
        </div>

        {/* 照片 */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-semibold">照片</label>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
            >
              📷 上传图片
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={photoInput}
              onChange={(e) => setPhotoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPhotoUrl()}
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ background: 'var(--input-bg,#f5f5f5)', borderColor: 'var(--border,#ddd)', color: 'inherit' }}
              placeholder="或粘贴图片URL，回车添加"
            />
            <button
              type="button"
              onClick={handleAddPhotoUrl}
              className="rounded-lg bg-gray-500 px-3 py-1.5 text-sm text-white hover:bg-gray-600"
            >
              +
            </button>
          </div>
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="group relative">
                  <img src={p} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
            style={{ borderColor: 'var(--border,#ddd)' }}
          >取消</button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-40"
          >保存</button>
        </div>
      </div>
    </div>
  );
};

// ============ 地点详情弹窗 ============
interface PlaceDetailProps {
  place: TravelPlace;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const PlaceDetail: React.FC<PlaceDetailProps> = ({ place, onEdit, onDelete, onClose }) => {
  const [photo, setPhoto] = useState(0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        style={{
          background: 'var(--bg-color,#fff)',
          color: 'var(--text-color,#222)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-2xl font-bold opacity-50 hover:opacity-90"
        >×</button>

        <div className="mb-2 flex items-center gap-2">
          <span className="text-xl">{place.status === 'visited' ? '🚩' : '📍'}</span>
          <h2 className="text-lg font-bold">{place.name}</h2>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold text-white ${place.status === 'visited' ? 'bg-green-500' : 'bg-red-500'}`}>
            {place.status === 'visited' ? '已去过' : '想去'}
          </span>
        </div>

        {place.visitDate && (
          <p className="mb-2 text-xs opacity-60">📅 {place.visitDate}</p>
        )}
        {place.description && (
          <p className="mb-3 text-sm leading-relaxed opacity-80">{place.description}</p>
        )}

        {/* 照片轮播 */}
        {place.photos.length > 0 && (
          <div className="mb-3 overflow-hidden rounded-xl">
            <div className="relative">
              <img
                src={place.photos[photo]}
                alt=""
                className="h-44 w-full object-cover"
              />
              {place.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhoto((p) => (p - 1 + place.photos.length) % place.photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-white text-lg hover:bg-black/60"
                  >‹</button>
                  <button
                    onClick={() => setPhoto((p) => (p + 1) % place.photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-white text-lg hover:bg-black/60"
                  >›</button>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                    {place.photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhoto(i)}
                        className={`h-1.5 rounded-full transition-all ${i === photo ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {place.blogUrl && (
          <a
            href={place.blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center gap-1 text-sm text-blue-500 hover:underline"
          >
            📝 查看博文 →
          </a>
        )}

        <p className="mb-4 text-xs opacity-30">
          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >编辑</button>
          <button
            onClick={onDelete}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >删除</button>
        </div>
      </div>
    </div>
  );
};

// ============ 主地图组件（MapLibre GL）============
interface TravelMapProps {
  places: TravelPlace[];
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick: (id: string) => void;
  isDark: boolean;
}

const TravelMap: React.FC<TravelMapProps> = ({ places, onMapClick, onMarkerClick, isDark }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // 用 ref 存储 markers，key = place.id
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current) return;

    const style = isDark ? MAP_STYLES.cartoDark : MAP_STYLES.liberty;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [104.1954, 35.8617], // 中国中心
      zoom: 3.8,
      minZoom: 2,
      maxZoom: 18,
      attributionControl: false,
    });

    // 添加导航控件
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // 添加简洁版 attribution
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // 点击地图空白处 → 添加地点
    map.on('click', (e) => {
      // 如果点击了 marker，则不触发地图点击
      if ((e.originalEvent.target as HTMLElement).closest('.travel-marker')) return;
      onMapClick(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // 同步切换地图样式（暗/亮）
  // 由于重新挂载地图比 setStyle 更可靠，这里依赖 isDark 重新初始化（上面 useEffect 已包含）

  // 同步 markers（增量更新）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(places.map((p) => p.id));

    // 删除已移除的 marker
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // 添加或更新
    places.forEach((place) => {
      if (markersRef.current.has(place.id)) {
        // 已存在：更新位置（如有拖拽功能则需要，这里简单处理）
        const existing = markersRef.current.get(place.id)!;
        existing.setLngLat([place.lng, place.lat]);
        // 更新图标颜色（如果 status 变化）
        const el = existing.getElement();
        const img = el.querySelector('img');
        if (img) {
          img.src =
            place.status === 'visited'
              ? svgToDataUrl(createFlagSVG())
              : svgToDataUrl(createPinSVG('#ef4444', 'white'));
        }
        return;
      }

      // 创建 marker 元素
      const el = document.createElement('div');
      el.className = 'travel-marker';
      el.style.cssText = 'cursor:pointer; width:28px; height:36px;';

      const img = document.createElement('img');
      img.style.cssText = 'width:100%; height:100%; pointer-events:none;';
      img.src =
        place.status === 'visited'
          ? svgToDataUrl(createFlagSVG())
          : svgToDataUrl(createPinSVG('#ef4444', 'white'));

      el.appendChild(img);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onMarkerClick(place.id);
      });

      // 悬停 tooltip
      el.title = place.name;

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      markersRef.current.set(place.id, marker);
    });
  }, [places, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-2xl overflow-hidden"
      style={{ minHeight: '500px' }}
    />
  );
};

// ============ 主页面 ============
const TravelPage: React.FC = () => {
  const [places, setPlaces] = useState<TravelPlace[]>(loadPlaces);
  const [showModal, setShowModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Partial<TravelPlace> | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<TravelPlace | null>(null);
  const [filter, setFilter] = useState<'all' | 'wishlist' | 'visited'>('all');
  // 检测当前是否暗色主题
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );

  // 监听主题切换
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // 持久化
  useEffect(() => {
    savePlaces(places);
  }, [places]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setEditingPlace({ lat, lng });
    setShowModal(true);
    setSelectedPlace(null);
  }, []);

  const handleMarkerClick = useCallback(
    (id: string) => {
      const found = places.find((p) => p.id === id);
      if (found) {
        setSelectedPlace(found);
        setShowModal(false);
      }
    },
    [places]
  );

  const handleSave = (place: TravelPlace) => {
    setPlaces((prev) => {
      const idx = prev.findIndex((p) => p.id === place.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = place;
        return next;
      }
      return [...prev, place];
    });
    setShowModal(false);
    setEditingPlace(null);
    setSelectedPlace(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确认删除这个地点？')) {
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      setSelectedPlace(null);
    }
  };

  const filteredPlaces = places.filter((p) => filter === 'all' || p.status === filter);
  const wishlistCount = places.filter((p) => p.status === 'wishlist').length;
  const visitedCount = places.filter((p) => p.status === 'visited').length;

  return (
    <Layout>
      <Helmet>
        <title>旅游地图 | GavenのHP</title>
        <meta name="description" content="旅游地图 - 记录想去和去过的地方" />
      </Helmet>

      <div className="flex w-full flex-col gap-5 lg:flex-row">
        {/* ── 左侧面板 ── */}
        <div className="flex w-full flex-col lg:w-80 lg:flex-shrink-0">

          {/* 统计 */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-red-50 p-4 dark:bg-red-950/20">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="text-2xl font-bold text-red-500">{wishlistCount}</p>
                  <p className="text-xs text-gray-500">想去的地方</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-green-50 p-4 dark:bg-green-950/20">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚩</span>
                <div>
                  <p className="text-2xl font-bold text-green-500">{visitedCount}</p>
                  <p className="text-xs text-gray-500">去过的地方</p>
                </div>
              </div>
            </div>
          </div>

          {/* 操作提示 */}
          <div className="mb-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-3 text-center text-sm text-blue-600 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400">
            🖱️ 点击地图任意位置添加地点
          </div>

          {/* 筛选 tab */}
          <div className="mb-3 flex gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {(['all', 'wishlist', 'visited'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                  filter === f
                    ? f === 'wishlist'
                      ? 'bg-red-500 text-white shadow'
                      : f === 'visited'
                        ? 'bg-green-500 text-white shadow'
                        : 'bg-white text-gray-800 shadow dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {f === 'all' ? `全部 ${places.length}` : f === 'wishlist' ? `想去 ${wishlistCount}` : `去过 ${visitedCount}`}
              </button>
            ))}
          </div>

          {/* 地点列表 */}
          <div
            className="flex-1 space-y-1.5 overflow-y-auto pr-1"
            style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '200px' }}
          >
            {filteredPlaces.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400 dark:bg-gray-800/30">
                {filter === 'all' ? '还没有地点，点击地图添加吧！' : `暂无${filter === 'wishlist' ? '想去' : '去过'}的地方`}
              </div>
            ) : (
              filteredPlaces.map((place) => (
                <button
                  key={place.id}
                  onClick={() => { setSelectedPlace(place); setShowModal(false); }}
                  className="w-full rounded-xl p-3 text-left transition-all hover:shadow-sm"
                  style={{
                    background:
                      selectedPlace?.id === place.id
                        ? place.status === 'visited'
                          ? 'rgba(34,197,94,0.1)'
                          : 'rgba(239,68,68,0.1)'
                        : 'var(--card-bg,rgba(0,0,0,0.03))',
                    border: `1.5px solid ${
                      selectedPlace?.id === place.id
                        ? place.status === 'visited'
                          ? '#22c55e'
                          : '#ef4444'
                        : 'transparent'
                    }`,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-base">
                      {place.status === 'visited' ? '🚩' : '📍'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{place.name}</p>
                      {place.description && (
                        <p className="mt-0.5 truncate text-xs opacity-50">{place.description}</p>
                      )}
                      {place.visitDate && (
                        <p className="mt-0.5 text-xs text-green-500">{place.visitDate}</p>
                      )}
                    </div>
                    {place.photos.length > 0 && (
                      <span className="flex-shrink-0 text-xs opacity-40">
                        📷{place.photos.length}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── 右侧地图 ── */}
        <div className="relative min-h-[520px] flex-1 lg:min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
          <TravelMap
            places={places}
            onMapClick={handleMapClick}
            onMarkerClick={handleMarkerClick}
            isDark={isDark}
          />

          {/* 图例 */}
          <div
            className="absolute bottom-8 left-3 rounded-xl px-3 py-2.5 shadow-lg"
            style={{ background: 'var(--bg-color,rgba(255,255,255,0.92))', backdropFilter: 'blur(8px)' }}
          >
            <p className="mb-1.5 text-xs font-semibold opacity-60">图例</p>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📍</span>
                <span>想去的地方</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🚩</span>
                <span>去过的地方</span>
              </div>
            </div>
          </div>

          {/* 地图来源标注 */}
          <div className="absolute bottom-1 left-3 text-[10px] opacity-30">
            地图底图：OpenFreeMap / CARTO（开源免费）
          </div>
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {showModal && editingPlace !== null && (
        <PlaceModal
          place={editingPlace}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingPlace(null); }}
        />
      )}

      {/* 详情弹窗 */}
      {selectedPlace && !showModal && (
        <PlaceDetail
          place={selectedPlace}
          onEdit={() => { setEditingPlace(selectedPlace); setShowModal(true); setSelectedPlace(null); }}
          onDelete={() => handleDelete(selectedPlace.id)}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </Layout>
  );
};

export default TravelPage;
