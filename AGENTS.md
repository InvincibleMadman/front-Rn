# Codex Project Instructions for ICPilot Frontend

## Language

* 默认使用中文回复。
* 修改总结、验证结果、风险说明使用中文。
* 代码注释可保留英文，但不要影响可读性。

## Project layout

当前前端项目目录是 `front-Ne`。它的同级目录包括：

* `../fuzz-server-He`：后端源码
* `../ui案例`：UI 设计参考图片
* `../genr`：现有产品基线设计图片

所有路径判断必须以实际文件系统为准，不要猜路径。

## Skill usage

本项目应使用 `ui-ux-pro-max` skill 的 UI/UX 设计规则。
如果 skill 已安装，请优先读取并应用它的设计系统生成、配色、布局、图表、动效、可访问性和反模式规则。
如果 skill 不可用，必须说明，并继续基于 `../ui案例` 和 `../genr` 执行。

## Highest priorities

1. 这是结构级前端改造，不是局部换色。
2. 不改变 API 访问代码。
3. 必须读取 `../ui案例` 中的图片，尤其是：

   * `IMG_1203.JPG`
   * `IMG_1205.JPG`
   * `IMG_1214.JPG`
4. 必须读取 `../genr` 中的基线页面，尤其是：

   * `1.png`
   * `3.png`
   * `4.png`
   * `5.png`
   * `6.png`
5. 必须保持真实 API 调用，不用 mock 数据掩盖接口问题。
6. 必须分阶段修改，每阶段完成后运行构建或搜索检查。
7. 不要一次性大改后不验证。

## API boundary

本任务原则上不得修改以下文件：

* `src/lib/api/client.*`
* `src/lib/api/services/*`
* 现有 API URL、method、request body 组装逻辑、response adapter、WebSocket 封装逻辑

允许读取这些文件理解 API 支持哪些参数。
允许在页面调用处、表单、选择框、状态管理、参数 UI 中增强输入能力。
如果必须修改 API 访问代码才能解决问题，必须先说明原因并等待确认。

## UI requirements

* 首页 `/` 独立，不显示左侧导航，不出现在导航栏。
* 首页必须有主 CTA“进入控制台”。
* 首页要做斜向层叠三页面演示轮播，三张页面构成平行四边形轮廓。
* 首页粒子效果为鼠标位置与附近粒子连线。
* 顶栏固定，左侧导航固定，底部全局日志栏固定。
* 页面主体独立滚动。
* 删除所有页面内部日志/控制台输出框。
* 所有正常输出和错误输出进入底部全局日志栏。
* 错误详情用 toast + 弹窗/抽屉 + 全局日志栏，不允许在组件内部大块显示。
* 导航栏收起后必须有可见展开按钮。
* 主题切换按钮放在右上角。
* 原主题按钮位置改成导航展开/收起按钮。
* 顶栏使用亚克力板模糊效果。
* 左上角 logo/icon 放大。
* 控制台整体字体放大。

## Theme requirements

浅色主题：

* 页面大背景使用更浅的白色或雾白。
* 组件卡片使用独立白色背景，必须区别于大背景。
* 导航栏背景为深蓝。
* 原蓝色加深。
* 部分按钮使用亮橙色。
* 首页浅色背景下文字必须可见。

深色主题：

* 页面大背景使用微微发紫的黑色。
* 组件卡片使用更亮一层的紫黑色。
* 卡片、输入框、表格、弹窗、日志栏必须区别于背景。
* 深色重点色参考 `ui案例/IMG_1205.JPG` 的偏粉紫柱状图颜色。
* 不要纯黑背景，不要组件和背景糊在一起。

## Layout requirements

* 必须采用紧凑、高信息密度布局。
* 反馈结果页面学习 `ui案例/IMG_1203.JPG` 的紧凑布局。
* 页面布局采用非对称式，学习 `ui案例/IMG_1214.JPG` 中的布局集合。
* 不要所有页面都是 1:1 两栏。
* 使用 7:5、8:4、3:6:3、主列 + 侧列、宽卡 + 窄卡、错落卡片等结构。
* 禁止用固定像素控制整体页面骨架。
* 检查并消除 `296px`、`108px`、`h-[680px]`、`h-[620px]`、`left-[296px]`、`pl-[296px]` 等旧式骨架写法。

## Page requirements

### Dashboard

以下卡片右侧必须加入紧凑中空饼图：

* 任务总数
* 运行中
* 失败任务
* 工作区引用
* 离线工作台产物
* 日志条目

### Task creation

在不改 API 访问代码前提下，读取 API 类型和 service 支持字段，在页面调用处补全所有可用输入项。
AFL 二进制必须做成选择框，至少提供：

* `afl-fuzz`
* `afl-showmap`
* `afl-cmin`
* `afl-tmin`
* `afl-analyze`

### Task list

任务列表过滤区不能只有执行状态，必须提供状态、协议、目标程序、节点、fuzzer、调度策略、risk、创建时间、更新时间、crash、hang、artifact、关键词、排序字段、排序方向等筛选能力。
如果 API 不支持部分字段，则做前端本地过滤并说明。

### GDB Debug

学习 `IMG_1203.JPG` 的紧凑布局。
左侧候选 seed / artifact / session，中间参数区，右侧报告和证据区。
输出进入底部全局日志栏。

### Vulnerability KB

学习 `IMG_1203.JPG` 的紧凑知识处理工作台。
左侧文档源 / 协议 / 漏洞条目，中间蒸馏和分析参数，右侧摘要 / 统计 / 引用池 / 状态。

## Landing animation requirements

首页必须实现：

1. 三张斜向层叠页面卡片。
2. 三张页面整体构成平行四边形轮廓。
3. 循环轮替。
4. 第一张消失后第二张前移。
5. 第三张前移为第二层。
6. 第一张回到第三张后面。
7. 前移到主位置的页面卡片内图表数据从 0 动画增长到固定目标数据。
8. 固定数据只用于首页演示，不用于真实控制台。
9. 增加轻量工业控制设备被攻击与预测发现动画。
10. 粒子背景使用 Canvas 或轻量实现，鼠标与附近粒子连线。
11. 支持 `prefers-reduced-motion`。
12. 清理 animation frame 和事件监听。

## Verification requirements

每阶段至少做对应检查：

* `npm run build`
* 如果存在：`npm run lint`
* 如果存在：`npm run typecheck`
* 搜索“事件流 / Event Stream / event stream”
* 搜索旧固定尺寸
* 搜索页面内部日志框残留
* 检查 `git diff -- src/lib/api`，原则上 API 访问代码不应变化

Additional execution rule:

* 如果用户没有明确要求运行 `npm run build`、`npm run lint`、`npm run typecheck` 或其它验证命令，则不要主动运行构建或验证。

最终输出必须包含：

* 修改文件清单
* API 文件是否未修改
* UI 设计落实说明
* 主题 token 说明
* 首页动画说明
* 日志和错误反馈说明
* 构建结果
* 未完成项

## Additional design reference map

Before any UI adjustment, read:

- `docs/design-reference-map.md`

This file is mandatory. Any UI repair must check whether each page/component actually matches its concrete reference product or image mapping.
