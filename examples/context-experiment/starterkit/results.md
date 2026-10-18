# Context experiment: results (starterkit)

| Condition | Acceptable | Not acceptable | Error types | Sent to human review by A |
|---|---:|---:|---|---:|
| C1 | 17/20 | 3 | other 2, terminology 1, meaning 1 | 0 |
| C2 | 19/20 | 1 | other 1 | 0 |
| C3 | 20/20 | 0 | - | 0 |

## Every unit

| Unit | Condition | English | Chinese | Acceptable | Error | Note |
|---|---|---|---|---|---|---|
| filterCount | C1 | 3 filters | 3 筛选器 | no | other | Grammar issue. |
| filterCount | C2 | 3 filters | 3 个筛选器 | yes |  |  |
| filterCount | C3 | 3 filters | 3 个筛选器 | yes |  |  |
| filtered | C1 | 10 items of 50 | 10 项目 ，共 50 | no | other | Grammar issue. |
| filtered | C2 | 10 items of 50 | 10 个项目 共 50 | no | other | Grammar issue. |
| filtered | C3 | 10 items of 50 | 10 个项目，共 50 个 | yes |  |  |
| header | C1 | 12 items • sorted by Name | 12 项目 • 排序标准 Name | no | terminology;meaning | Like J15/J56 for "Name", and also not natural language. |
| header | C2 | 12 items • sorted by Name | 12 个项目 • 排序依据： Name | yes |  | Judge: should "Name" be translated here? If not, the translation is good. "Name" is an example value for the sort field, which Salesforce fills with its own (translated) field label at runtime, so it is not part of this translation; resolved as acceptable. |
| header | C3 | 12 items • sorted by Name | 12 个项目 • 按 Name 排序 | yes |  | Same as J15: acceptable if "Name" is not part of the translation, which it is not (runtime field label). |
| LMR_Apply | C1 | Apply | 应用 | yes |  |  |
| LMR_Apply | C2 | Apply | 应用 | yes |  |  |
| LMR_Apply | C3 | Apply | 应用 | yes |  |  |
| LMR_Cancel | C1 | Cancel | 取消 | yes |  |  |
| LMR_Cancel | C2 | Cancel | 取消 | yes |  |  |
| LMR_Cancel | C3 | Cancel | 取消 | yes |  |  |
| LMR_ClearAll | C1 | Clear All | 全部清除 | yes |  |  |
| LMR_ClearAll | C2 | Clear All | 全部清除 | yes |  |  |
| LMR_ClearAll | C3 | Clear All | 全部清除 | yes |  |  |
| LMR_DefineDateRangeTitle | C1 | Define a date range | 定义日期范围 | yes |  |  |
| LMR_DefineDateRangeTitle | C2 | Define a date range | 定义日期范围 | yes |  |  |
| LMR_DefineDateRangeTitle | C3 | Define a date range | 定义日期范围 | yes |  |  |
| LMR_Disabled | C1 | Disabled | 已禁用 | yes |  |  |
| LMR_Disabled | C2 | Disabled | 已禁用 | yes |  |  |
| LMR_Disabled | C3 | Disabled | 已禁用 | yes |  |  |
| LMR_Enabled | C1 | Enabled | 已启用 | yes |  |  |
| LMR_Enabled | C2 | Enabled | 已启用 | yes |  |  |
| LMR_Enabled | C3 | Enabled | 已启用 | yes |  |  |
| LMR_EndDate | C1 | End Date | 结束日期 | yes |  |  |
| LMR_EndDate | C2 | End Date | 结束日期 | yes |  |  |
| LMR_EndDate | C3 | End Date | 结束日期 | yes |  |  |
| LMR_ErrorTitle | C1 | Something went wrong. | 出现问题。 | yes |  |  |
| LMR_ErrorTitle | C2 | Something went wrong. | 出现问题。 | yes |  |  |
| LMR_ErrorTitle | C3 | Something went wrong. | 出现问题。 | yes |  |  |
| LMR_FilterTitle | C1 | Filter | 筛选器 | yes |  |  |
| LMR_FilterTitle | C2 | Filter | 筛选器 | yes |  |  |
| LMR_FilterTitle | C3 | Filter | 筛选器 | yes |  |  |
| LMR_None | C1 | None | 无 | yes |  |  |
| LMR_None | C2 | None | 无 | yes |  |  |
| LMR_None | C3 | None | 无 | yes |  |  |
| LMR_RecordIsUpdated | C1 | Record Is Updated | 记录已更新 | yes |  |  |
| LMR_RecordIsUpdated | C2 | Record Is Updated | 记录已更新 | yes |  |  |
| LMR_RecordIsUpdated | C3 | Record Is Updated | 记录已更新 | yes |  |  |
| LMR_Save | C1 | Save | 保存 | yes |  |  |
| LMR_Save | C2 | Save | 保存 | yes |  |  |
| LMR_Save | C3 | Save | 保存 | yes |  |  |
| LMR_Search | C1 | Search | 搜索 | yes |  |  |
| LMR_Search | C2 | Search | 搜索 | yes |  |  |
| LMR_Search | C3 | Search | 搜索 | yes |  |  |
| LMR_Select | C1 | select | 选择 | yes |  |  |
| LMR_Select | C2 | select | 选择 | yes |  |  |
| LMR_Select | C3 | select | 选择 | yes |  |  |
| LMR_StartDate | C1 | Start Date | 开始日期 | yes |  |  |
| LMR_StartDate | C2 | Start Date | 开始日期 | yes |  |  |
| LMR_StartDate | C3 | Start Date | 开始日期 | yes |  |  |
| LMR_SuccessTitle | C1 | Success | 成功 | yes |  |  |
| LMR_SuccessTitle | C2 | Success | 成功 | yes |  |  |
| LMR_SuccessTitle | C3 | Success | 成功 | yes |  |  |
| selected | C1 | 3 selected | 3 已选择 | yes |  |  |
| selected | C2 | 3 selected | 3 已选择 | yes |  |  |
| selected | C3 | 3 selected | 已选择 3 项 | yes |  |  |
