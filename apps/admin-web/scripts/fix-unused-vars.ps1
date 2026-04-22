# Fix unused vars/imports batch script
# Generated from lint_output_new.txt analysis

# --- E2E & SCRIPTS ---
(Get-Content 'e2e\calendar.spec.ts' -Raw) -replace '\binitialContent\b', '_initialContent' -replace '\btodaySection\b', '_todaySection' | Set-Content 'e2e\calendar.spec.ts'
(Get-Content 'e2e\dashboard-charts.spec.ts' -Raw) -replace '(?<=test\.describe\.serial\(.+?,\s*async\s*\(\{)\s*page\b', ' _page' | Set-Content 'e2e\dashboard-charts.spec.ts'
(Get-Content 'e2e\order-management.spec.ts' -Raw) -replace '\bbulkActions\b', '_bulkActions' | Set-Content 'e2e\order-management.spec.ts'

Write-Host "Done! Run 'npx next lint' to verify."
