每个块创建的时候必须填写对应的 type 字段，如文本块需要填写 type 字段为 "text"具体类型请参考 BlockTypes。

每个块有单独的属性可以设置，具体的字段参考下方 

目前 file, database, meeting, reference, simple_table, template_button, row, column无法使用在创建块接口中使用。

## 文本块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"text"`|文本块类型|`必填`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|




## 标题块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"heading"`|标题块类型|`必填`|
|level|HeadingLevel|标题级别，支持数字 1-4|`必填`|
|toggle|`boolean`|是否折叠|`可选`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|




## 页面块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"page"`|页面块类型|`必填`|
|icon|LinkIcon 或 EmojiIcon|图标|`可选`|
|page_cover|LinkCover|封面|`可选`|
|page_setting|PageSetting|页面设置|`可选`|
|content|CreateRichText|页面标题|`可选`|


## 代码块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"code"`|代码块类型|`必填`|
|language|CodeLanguage|代码语言 (例如 "python", "html" 等)|`必填`|
|code_setting|CodeSetting|代码设置|`可选`|
|caption|`string`|代码块说明|`可选`|
|content|CreateRichText|代码内容|`可选`|




## 引用块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"quote"`|引用块类型|`必填`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|


## 着重文字块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"callout"`|着重文字块类型|`必填`|
|icon|LinkIcon 或 EmojiIcon|图标|`可选`|
|marquee_mode|`boolean`|跑马灯模式|`可选`|
|content|CreateRichText|页面标题|`可选`|




## 媒体块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`string`|媒体块类型，可能的值有 `"image"`,`"video"`,`"audio"`|`必填`|
|link|`string`|图片/视频/音频链接|`必填`|
|caption|`string`|说明文字|`可选`|


## 分隔符块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"divider"`|分割线类型|`必填`|




## 进度条块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"progress_bar"`|进度条类型|`必填`|
|progress|`number`|可填入 0 - 100 的数字|`必填`|
|auto_mode|`boolean`|自动模式，开启后进度条左边会出现勾选图标，并且不再允许手动调整进度|`可选`|
|hide_number|`boolean`|隐藏进度条数字|`可选`|




## 书签块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"bookmark"`|书签类型|`必填`|
|link|`string`|书签链接|`必填`|




## 有序列表块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"enum_list"`|有序列表类型|`必填`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|




## 任务列表块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"todo_list"`|任务列表类型|`必填`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|
|checked|`boolean`|任务完成状态[//]: # (不填，默认为未完成状态)|`可选`|




## 高级任务列表块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"todo_list_pro"`|高级任务列表类型|`必填`|
|task_status|TodoListProStatus|任务完成状态，可能的有`"todo"`,`"doing"`,`"done"`,`"cancel"`[//]: # (默认为 "todo" 状态)|`可选`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|




## 无序列表块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"bull_list"`|无序列表类型|`必填`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|


## 折叠列表块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"toggle_list"`|折叠列表类型|`必填`|
|content|CreateRichText|文本内容。具体参考CreateRichText|`可选`|


## 公式块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"block_equation"`|公式块类型|`必填`|
|content[//]: # (公式块的内容建议直接传递纯文本，如 content: "e^2")|CreateRichText|文本内容。具体参考CreateRichText|`可选`|




## 三方嵌入块

|属性|类型|描述|可选|
|-|-|-|-|
|type|`"embed"`|三方嵌入类型|`必填`|
|original_link|`string`|原始链接|`必填`|
|embed_link|`string`|嵌入链接|`可选`|


---
# CreateRichText
string 或 RichText或 （RichText 或 string）数组  或 不传递（可选字段）

注意：创建块的 RichText 的 type 暂时只支持 "text" 和 "equation"

**例子：**

```JSON
// 纯文本 string
"hello"

或

// 富文本 RichText
{ 
  // "type": "text", // 注意纯文本时，这个字段可以不传递
  "title": "hello",
  "bold": true
}

或
// 数组 支持 RichText 和 string 混合

[
  { 
    // "type": "text", // 注意纯文本时，这个字段可以不传递
    "title": "hello",
    "bold": true
  },
  "world!"
]
或
// 不传递, 则生成一个无内容的块
```

## RichText
|属性名|类型|描述|
|-|-|-|
|type|InlineTitleType|行内标题类型|
|title|`string`|标题|
|bold|`boolean`|是否加粗|
|italic|`boolean`|是否斜体|
|underline|`boolean`|是否下划线|
|highlight|`boolean`|是否高亮|
|strikethrough|`boolean`|是否删除线|
|inline_code|`boolean`|是否行内代码|
|front_color|BlockFrontColors|前景色|
|back_color|BlockBackColors|背景色|


