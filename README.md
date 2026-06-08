# 闪避冲刺

一个零依赖的网页端躲避小游戏。玩家通过方向键、WASD 或触屏拖动移动角色，躲避不断下落的障碍物，尽量获得更高分。

## 本地运行

直接打开 `index.html` 即可，或启动本地静态服务器：

```bash
python3 -m http.server 5173
```

然后访问：

```text
http://127.0.0.1:5173/
```

## GitHub Pages 部署

这个仓库已经包含 GitHub Pages Actions 配置。推送到 GitHub 的 `main` 分支后，会自动部署静态站点。

部署前需要在 GitHub 仓库设置中启用 Pages：

1. 打开仓库的 `Settings`。
2. 进入 `Pages`。
3. 在 `Build and deployment` 中将 `Source` 设为 `GitHub Actions`。
4. 推送 `main` 分支后，等待 `Deploy static site to GitHub Pages` 工作流完成。
