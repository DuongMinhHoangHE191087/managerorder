---
name: server-management
description: Server management principles and decision-making. Process management, monitoring strategy, and scaling decisions. Teaches thinking, not commands.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Server Management

> Server management principles for production operations.
> **Learn to THINK, not memorize commands.**

---

## 1. Process Management Principles

### Tool Selection

| Scenario | Tool |
|----------|------|
| **Node.js app** | PM2 (clustering, reload) |
| **Any app** | systemd (Linux native) |
| **Containers** | Docker/Podman |
| **Orchestration** | Kubernetes, Docker Swarm |

### Process Management Goals

| Goal | What It Means |
|------|---------------|
| **Restart on crash** | Auto-recovery |
| **Zero-downtime reload** | No service interruption |
| **Clustering** | Use all CPU cores |
| **Persistence** | Survive server reboot |

---

## 2. Monitoring Principles

### What to Monitor

| Category | Key Metrics |
|----------|-------------|
| **Availability** | Uptime, health checks |
| **Performance** | Response time, throughput |
| **Errors** | Error rate, types |
| **Resources** | CPU, memory, disk |

### Alert Severity Strategy

| Level | Response |
|-------|----------|
| **Critical** | Immediate action |
| **Warning** | Investigate soon |
| **Info** | Review daily |

### Monitoring Tool Selection

| Need | Options |
|------|---------|
| Simple/Free | PM2 metrics, htop |
| Full observability | Grafana, Datadog |
| Error tracking | Sentry |
| Uptime | UptimeRobot, Pingdom |

---

## 3. Log Management Principles

### Log Strategy

| Log Type | Purpose |
|----------|---------|
| **Application logs** | Debug, audit |
| **Access logs** | Traffic analysis |
| **Error logs** | Issue detection |

### Log Principles

1. **Rotate logs** to prevent disk fill
2. **Structured logging** (JSON) for parsing
3. **Appropriate levels** (error/warn/info/debug)
4. **No sensitive data** in logs

---

## 4. Scaling Decisions

### When to Scale

| Symptom | Solution |
|---------|----------|
| High CPU | Add instances (horizontal) |
| High memory | Increase RAM or fix leak |
| Slow response | Profile first, then scale |
| Traffic spikes | Auto-scaling |

### Scaling Strategy

| Type | When to Use |
|------|-------------|
| **Vertical** | Quick fix, single instance |
| **Horizontal** | Sustainable, distributed |
| **Auto** | Variable traffic |

---

## 5. Health Check Principles

### What Constitutes Healthy

| Check | Meaning |
|-------|---------|
| **HTTP 200** | Service responding |
| **Database connected** | Data accessible |
| **Dependencies OK** | External services reachable |
| **Resources OK** | CPU/memory not exhausted |

### Health Check Implementation

- Simple: Just return 200
- Deep: Check all dependencies
- Choose based on load balancer needs

---

## 6. Security Principles

| Area | Principle |
|------|-----------|
| **Access** | SSH keys only, no passwords |
| **Firewall** | Only needed ports open |
| **Updates** | Regular security patches |
| **Secrets** | Environment vars, not files |
| **Audit** | Log access and changes |

---

## 7. Troubleshooting Priority

When something's wrong:

1. **Check if running** (process status)
2. **Check logs** (error messages)
3. **Check resources** (disk, memory, CPU)
4. **Check network** (ports, DNS)
5. **Check dependencies** (database, APIs)

---

## 8. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Run as root | Use non-root user |
| Ignore logs | Set up log rotation |
| Skip monitoring | Monitor from day one |
| Manual restarts | Auto-restart config |
| No backups | Regular backup schedule |

---

> **Remember:** A well-managed server is boring. That's the goal.


<!-- MERGED FROM docker-expert -->

---
version: 4.1.0-fractal
name: docker-expert
description: Docker containerization expert with deep knowledge of multi-stage builds, image optimization, container security, Docker Compose orchestration, and production deployment patterns. Use PROACTIVELY for Dockerfile optimization, container issues, image size problems, security hardening, networking, and orchestration challenges.
category: devops
color: blue
displayName: Docker Expert
---

# Docker Expert

You are an advanced Docker containerization expert with comprehensive, practical knowledge of container optimization, security hardening, multi-stage builds, orchestration patterns, and production deployment strategies based on current industry best practices.

## When invoked:

0. If the issue requires ultra-specific expertise outside Docker, recommend switching and stop:
   - Kubernetes orchestration, pods, services, ingress → kubernetes-expert (future)
   - GitHub Actions CI/CD with containers → github-actions-expert
   - AWS ECS/Fargate or cloud-specific container services → devops-expert
   - Database containerization with complex persistence → database-expert

   Example to output:
   "This requires Kubernetes orchestration expertise. Please invoke: 'Use the kubernetes-expert subagent.' Stopping here."

1. Analyze container setup comprehensively:
   
   **Use internal tools first (Read, Grep, Glob) for better performance. Shell commands are fallbacks.**
   
   ```bash
   # Docker environment detection
   docker --version 2>/dev/null || echo "No Docker installed"
   docker info | grep -E "Server Version|Storage Driver|Container Runtime" 2>/dev/null
   docker context ls 2>/dev/null | head -3
   
   # Project structure analysis
   find . -name "Dockerfile*" -type f | head -10
   find . -name "*compose*.yml" -o -name "*compose*.yaml" -type f | head -5
   find . -name ".dockerignore" -type f | head -3
   
   # Container status if running
   docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null | head -10
   docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null | head -10
   ```
   
   **After detection, adapt approach:**
   - Match existing Dockerfile patterns and base images
   - Respect multi-stage build conventions
   - Consider development vs production environments
   - Account for existing orchestration setup (Compose/Swarm)

2. Identify the specific problem category and complexity level

3. Apply the appropriate solution strategy from my expertise

4. Validate thoroughly:
   ```bash
   # Build and security validation
   docker build --no-cache -t test-build . 2>/dev/null && echo "Build successful"
   docker history test-build --no-trunc 2>/dev/null | head -5
   docker scout quickview test-build 2>/dev/null || echo "No Docker Scout"
   
   # Runtime validation
   docker run --rm -d --name validation-test test-build 2>/dev/null
   docker exec validation-test ps aux 2>/dev/null | head -3
   docker stop validation-test 2>/dev/null
   
   # Compose validation
   docker-compose config 2>/dev/null && echo "Compose config valid"
   ```

## Core Expertise Areas

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [1. Dockerfile Optimization & Multi-Stage Builds](./sub-skills/1-dockerfile-optimization-multi-stage-builds.md)
### 2. [2. Container Security Hardening](./sub-skills/2-container-security-hardening.md)
### 3. [3. Docker Compose Orchestration](./sub-skills/3-docker-compose-orchestration.md)
### 4. [4. Image Size Optimization](./sub-skills/4-image-size-optimization.md)
### 5. [5. Development Workflow Integration](./sub-skills/5-development-workflow-integration.md)
### 6. [6. Performance & Resource Management](./sub-skills/6-performance-resource-management.md)
### 7. [Cross-Platform Builds](./sub-skills/cross-platform-builds.md)
### 8. [Build Cache Optimization](./sub-skills/build-cache-optimization.md)
### 9. [Secrets Management](./sub-skills/secrets-management.md)
### 10. [Health Check Strategies](./sub-skills/health-check-strategies.md)
### 11. [Dockerfile Optimization & Multi-Stage Builds](./sub-skills/dockerfile-optimization-multi-stage-builds.md)
### 12. [Container Security Hardening](./sub-skills/container-security-hardening.md)
### 13. [Docker Compose & Orchestration](./sub-skills/docker-compose-orchestration.md)
### 14. [Image Size & Performance](./sub-skills/image-size-performance.md)
### 15. [Development Workflow Integration](./sub-skills/development-workflow-integration.md)
### 16. [Networking & Service Discovery](./sub-skills/networking-service-discovery.md)
### 17. [Build Performance Issues](./sub-skills/build-performance-issues.md)
### 18. [Security Vulnerabilities](./sub-skills/security-vulnerabilities.md)
### 19. [Image Size Problems](./sub-skills/image-size-problems.md)
### 20. [Networking Issues](./sub-skills/networking-issues.md)
### 21. [Development Workflow Problems](./sub-skills/development-workflow-problems.md)


<!-- MERGED FROM deployment-procedures -->

---
name: deployment-procedures
description: Production deployment principles and decision-making. Safe deployment workflows, rollback strategies, and verification. Teaches thinking, not scripts.
allowed-tools: Read, Glob, Grep, Bash
---

# Deployment Procedures

> Deployment principles and decision-making for safe production releases.
> **Learn to THINK, not memorize scripts.**

---

## ⚠️ How to Use This Skill

This skill teaches **deployment principles**, not bash scripts to copy.

- Every deployment is unique
- Understand the WHY behind each step
- Adapt procedures to your platform

---

## 1. Platform Selection

### Decision Tree

```
What are you deploying?
│
├── Static site / JAMstack
│   └── Vercel, Netlify, Cloudflare Pages
│
├── Simple web app
│   ├── Managed → Railway, Render, Fly.io
│   └── Control → VPS + PM2/Docker
│
├── Microservices
│   └── Container orchestration
│
└── Serverless
    └── Edge functions, Lambda
```

### Each Platform Has Different Procedures

| Platform | Deployment Method |
|----------|------------------|
| **Vercel/Netlify** | Git push, auto-deploy |
| **Railway/Render** | Git push or CLI |
| **VPS + PM2** | SSH + manual steps |
| **Docker** | Image push + orchestration |
| **Kubernetes** | kubectl apply |

---

## 2. Pre-Deployment Principles

### The 4 Verification Categories

| Category | What to Check |
|----------|--------------|
| **Code Quality** | Tests passing, linting clean, reviewed |
| **Build** | Production build works, no warnings |
| **Environment** | Env vars set, secrets current |
| **Safety** | Backup done, rollback plan ready |

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Production build successful
- [ ] Environment variables verified
- [ ] Database migrations ready (if any)
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Monitoring ready

---

## 3. Deployment Workflow Principles

### The 5-Phase Process

```
1. PREPARE
   └── Verify code, build, env vars

2. BACKUP
   └── Save current state before changing

3. DEPLOY
   └── Execute with monitoring open

4. VERIFY
   └── Health check, logs, key flows

5. CONFIRM or ROLLBACK
   └── All good? Confirm. Issues? Rollback.
```

### Phase Principles

| Phase | Principle |
|-------|-----------|
| **Prepare** | Never deploy untested code |
| **Backup** | Can't rollback without backup |
| **Deploy** | Watch it happen, don't walk away |
| **Verify** | Trust but verify |
| **Confirm** | Have rollback trigger ready |

---

## 4. Post-Deployment Verification

### What to Verify

| Check | Why |
|-------|-----|
| **Health endpoint** | Service is running |
| **Error logs** | No new errors |
| **Key user flows** | Critical features work |
| **Performance** | Response times acceptable |

### Verification Window

- **First 5 minutes**: Active monitoring
- **15 minutes**: Confirm stable
- **1 hour**: Final verification
- **Next day**: Review metrics

---

## 5. Rollback Principles

### When to Rollback

| Symptom | Action |
|---------|--------|
| Service down | Rollback immediately |
| Critical errors | Rollback |
| Performance >50% degraded | Consider rollback |
| Minor issues | Fix forward if quick |

### Rollback Strategy by Platform

| Platform | Rollback Method |
|----------|----------------|
| **Vercel/Netlify** | Redeploy previous commit |
| **Railway/Render** | Rollback in dashboard |
| **VPS + PM2** | Restore backup, restart |
| **Docker** | Previous image tag |
| **K8s** | kubectl rollout undo |

### Rollback Principles

1. **Speed over perfection**: Rollback first, debug later
2. **Don't compound errors**: One rollback, not multiple changes
3. **Communicate**: Tell team what happened
4. **Post-mortem**: Understand why after stable

---

## 6. Zero-Downtime Deployment

### Strategies

| Strategy | How It Works |
|----------|--------------|
| **Rolling** | Replace instances one by one |
| **Blue-Green** | Switch traffic between environments |
| **Canary** | Gradual traffic shift |

### Selection Principles

| Scenario | Strategy |
|----------|----------|
| Standard release | Rolling |
| High-risk change | Blue-green (easy rollback) |
| Need validation | Canary (test with real traffic) |

---

## 7. Emergency Procedures

### Service Down Priority

1. **Assess**: What's the symptom?
2. **Quick fix**: Restart if unclear
3. **Rollback**: If restart doesn't help
4. **Investigate**: After stable

### Investigation Order

| Check | Common Issues |
|-------|--------------|
| **Logs** | Errors, exceptions |
| **Resources** | Disk full, memory |
| **Network** | DNS, firewall |
| **Dependencies** | Database, APIs |

---

## 8. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Deploy on Friday | Deploy early in week |
| Rush deployment | Follow the process |
| Skip staging | Always test first |
| Deploy without backup | Backup before deploy |
| Walk away after deploy | Monitor for 15+ min |
| Multiple changes at once | One change at a time |

---

## 9. Decision Checklist

Before deploying:

- [ ] **Platform-appropriate procedure?**
- [ ] **Backup strategy ready?**
- [ ] **Rollback plan documented?**
- [ ] **Monitoring configured?**
- [ ] **Team notified?**
- [ ] **Time to monitor after?**

---

## 10. Best Practices

1. **Small, frequent deploys** over big releases
2. **Feature flags** for risky changes
3. **Automate** repetitive steps
4. **Document** every deployment
5. **Review** what went wrong after issues
6. **Test rollback** before you need it

---

> **Remember:** Every deployment is a risk. Minimize risk through preparation, not speed.


<!-- MERGED FROM bash-linux -->

---
name: bash-linux
description: Bash/Linux terminal patterns and critical commands.
category: tools
version: 4.1.0-fractal
layer: master-skill
---

# Bash Linux Patterns

> Essential patterns for Bash on Linux/macOS.

---

## 1. Operator Syntax

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Chaining Commands](./sub-skills/chaining-commands.md)
### 2. [Essential Commands](./sub-skills/essential-commands.md)
### 3. [Core Tools](./sub-skills/core-tools.md)
### 4. [Check if command exists](./sub-skills/check-if-command-exists.md)
### 5. [Default variable value](./sub-skills/default-variable-value.md)
### 6. [Read file line by line](./sub-skills/read-file-line-by-line.md)
### 7. [Loop over files](./sub-skills/loop-over-files.md)
### 8. [Set options](./sub-skills/set-options.md)
### 9. [Trap for cleanup](./sub-skills/trap-for-cleanup.md)


<!-- MERGED FROM powershell-windows -->

---
name: powershell-windows
description: PowerShell Windows patterns and pitfalls.
category: tools
version: 4.1.0-fractal
layer: master-skill
---

# PowerShell Windows Patterns

> Critical patterns and pitfalls for Windows PowerShell.

---

## 1. Operator Syntax Rules

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [CRITICAL: Parentheses Required](./sub-skills/critical-parentheses-required.md)
### 2. [CRITICAL: No Unicode in Scripts](./sub-skills/critical-no-unicode-in-scripts.md)
### 3. [Always Check Before Access](./sub-skills/always-check-before-access.md)
### 4. [Complex Expressions](./sub-skills/complex-expressions.md)
### 5. [ErrorActionPreference](./sub-skills/erroractionpreference.md)
### 6. [Try/Catch Pattern](./sub-skills/trycatch-pattern.md)
### 7. [Windows Path Rules](./sub-skills/windows-path-rules.md)
### 8. [Correct Patterns](./sub-skills/correct-patterns.md)
### 9. [CRITICAL: Depth Parameter](./sub-skills/critical-depth-parameter.md)
### 10. [File Operations](./sub-skills/file-operations.md)

