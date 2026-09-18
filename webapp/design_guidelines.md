# Droiduse Design Guidelines

## Design Approach
**Selected System:** Linear/Notion-inspired modern productivity design with Material Design components
**Justification:** Technical marketplace requiring clarity, efficiency, and professional aesthetics for developers and AI practitioners

## Typography System

**Font Stack:** Inter (primary), JetBrains Mono (code/technical data)
- Hero Headlines: 48px/56px, font-weight 700
- Section Headers: 32px/40px, font-weight 600  
- Card Titles: 20px/28px, font-weight 600
- Body Text: 16px/24px, font-weight 400
- Captions/Meta: 14px/20px, font-weight 500
- Technical Data: 14px/20px, JetBrains Mono

## Layout & Spacing

**Tailwind Unit System:** Use 2, 4, 6, 8, 12, 16, 24 units consistently
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Card gaps: gap-6
- Container max-width: max-w-7xl

**Grid System:**
- Marketplace cards: 3-column grid (lg:grid-cols-3 md:grid-cols-2)
- Dashboard widgets: 2-column responsive (lg:grid-cols-2)
- Device list: Full-width stacked cards with status indicators

## Core Components

**Navigation Header:**
- Fixed top bar with logo left, search center, user menu right
- Height: h-16
- Shadow: subtle elevation
- Quick access tabs: Marketplace, Dashboard, Devices, Contribute

**Marketplace Cards:**
- Rounded corners (rounded-lg)
- Hover elevation effect
- Structure: App icon top, title, description, metadata row (score badge, type tag, downloads)
- Action: "View Details" link bottom-right

**Knowledge Entry Detail:**
- Hero section: App icon + title + metadata horizontal layout
- Tabbed content: Overview, Implementation, Examples
- Sidebar: Quick stats, contributor info, related knowledge
- CTA: "Add to Collection" or "Try on Device"

**Dashboard Layout:**
- Sidebar navigation (w-64): My Knowledge, Devices, Analytics, Settings
- Main content area: Stats cards row, recent activity table, quick actions
- Stats cards: 4-column grid showing contributions, devices, interactions, score

**Device Management:**
- Card-based device list with live status indicators
- Each card: Device name, Android version, status pill (Online/Offline/Busy), last active time
- Expandable section showing: Send instruction textarea, recent commands history
- "Add Device" prominent CTA with QR code modal

**Search & Filters:**
- Persistent search bar: Full-width with icon
- Filter sidebar (collapsible on mobile): App category checkboxes, score range slider, knowledge type toggles
- Active filters display as dismissible pills above results
- Sort dropdown: Hottest, Newest, Top Rated, Most Used

**Contribution Form:**
- Multi-step wizard: Select Type → App Details → Knowledge Content → Review
- Form fields: Generous spacing (space-y-6), clear labels above inputs
- Rich text editor for knowledge content with markdown preview
- App selector: Searchable dropdown with icons

**WebSocket Status Indicators:**
- Real-time connection badge in header (green dot + "Connected")
- Device cards pulse gently when receiving instructions
- Toast notifications for instruction responses

## Interaction Patterns

**States:**
- Loading: Skeleton screens with shimmer effect
- Empty states: Illustration + helpful text + primary action
- Error: Inline validation, toast for system errors
- Success: Subtle confirmation animations

**Micro-interactions:**
- Card hover: Slight scale (scale-105) + shadow increase
- Button press: Scale down slightly
- Status transitions: Smooth color/icon changes
- Tab switches: Slide animation

## Images

**Hero Section:** 
Large abstract illustration representing AI + Android integration (1440x600px)
- Positioning: Full-width background with gradient overlay
- Content overlay: Centered headline + search bar + quick stats row

**Marketing Sections:**
- Features section: 3-column layout with icons + screenshots showing marketplace browsing, device control panel, knowledge contribution
- How It Works: Step-by-step illustrations (3 images, 400x300px each)

**Content Images:**
- App icons: 64x64px, rounded-lg throughout interface
- Device screenshots: Embedded in knowledge entries, max-width with rounded corners
- Empty states: 240x240px centered illustrations

## Page-Specific Layouts

**Landing Page:**
1. Hero: Full-width with search + stats (devices connected, knowledge entries)
2. Featured Knowledge: 3-column card grid
3. How It Works: 3-step visual guide
4. Integration showcase: Screenshot + feature list
5. CTA: "Start Contributing" + "Connect Device"

**Marketplace:**
- Sticky filter sidebar (left, w-64)
- Main content: Search bar + sort controls + results grid
- Pagination: Bottom with page numbers

**Dashboard:**
- Two-panel: Sidebar nav (w-64) + main content
- Top: Welcome header + quick stats (4-card grid)
- Below: Tabbed sections (Activity, Devices, Analytics)

**Device Detail:**
- Split view: Device info panel (left, w-96) + interaction feed (right, flex-1)
- Instruction composer: Fixed bottom bar with send button
- History: Scrollable timeline of commands/responses

## Accessibility

- All interactive elements: Minimum 44x44px touch targets
- Form inputs: Consistent height (h-12), clear focus states with ring
- Status indicators: Icon + text (not color alone)
- Keyboard navigation: Visible focus rings, logical tab order