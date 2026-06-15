# Triton Benchmark 组会讲稿

## 一版可直接讲的口播稿

大家好，我这次汇报的主题是 Triton 在实际 benchmark 里的性能表现、当前暴露出来的主要瓶颈，以及我对后续优化方向的整理。

这次工作我没有只看单一指标，而是分成了两条线来做。第一条线是端到端模型 benchmark，主要看 `torch.compile + Inductor + Triton` 放到真实模型里以后，整体推理延迟到底有没有改善。第二条线是单算子和 profiling 分析，主要看 Triton 生成出来的 kernel 本身在硬件层面卡在什么地方。这样做的好处是，既能看到最终效果，也能把问题定位到更细的层级，避免只看 speedup 但不知道瓶颈在哪里。

先说端到端结果。从 torchbenchmark 这条线看，这次一共覆盖了 104 个模型，其中成功跑通并拿到有效结果的是 28 个，另外还有一部分是依赖缺失、OOM、timeout 或者提前跳过。虽然不是全覆盖，但这 28 个结果已经能把几类典型工作负载基本覆盖到，包括标准 CNN、轻量级 CNN、NLP、科学计算、量化模型和少量视频模型。

从结果上看，整体趋势还是比较清晰的。第一类是 CNN 和科学计算模型，收益最明显。像 `pyhpc_isoneutral_mixing` 能到 34 倍，`pyhpc_equation_of_state` 大概 15 倍；常见 CNN 里，`mobilenet_v3_large`、`shufflenet_v2`、`mobilenet_v2`、`resnet152` 这一类大多在 5 到 8 倍之间。第二类是 BERT、cm3leon 这类模型，能看到一定收益，但没有前一类那么夸张，基本是 1 到 2 倍。第三类是量化模型和动态 shape 模型，目前回退最明显，比如 `nanogpt` 只有 0.10 倍，`Super_SloMo` 大概 0.30 倍，两个量化模型也都低于 1 倍。

这里我觉得最值得强调的一点是，这次 benchmark 说明 Triton 不是“所有模型都无脑变快”的方案，它的收益非常依赖 workload 类型。规则性强、融合空间大的模型收益会比较大；动态 shape、多控制流、量化路径不完整的场景，现阶段反而更容易暴露问题。这个结论我觉得是有价值的，因为它把 Triton 当前更适合什么、不适合什么，边界画得比较清楚。

接下来再看 profiling 结果。模型级 NCU 我这次重点选了 7 个代表模型去做，不是把 28 个全量都 profile 一遍。原因主要有两个：第一，`ncu --set full` 的时间成本比较高，一个模型通常就要 5 到 10 分钟，复杂模型还会更长；第二，7 个样本已经能覆盖标准 CNN、轻量级 CNN、大参数 CNN 和 NLP 这些主要类别，所以这一步更偏向“代表性采样”，目标是快速识别共性瓶颈，而不是把所有模型机械地 profile 一遍。

从这 7 个模型里，最核心的观察是一个有点反直觉的现象：很多模型整体 speedup 很高，但 Triton 自己在 GPU 时间里的占比并不高。比如 `mobilenet_v2` 和 `shufflenet_v2` 端到端能到 6 到 7 倍，但 Triton kernel 的 GPU 时间占比只有 0.1% 到 0.3%。相反，真正占大头的通常还是 cuBLAS 或 cuDNN，尤其是在卷积和 GEMM 上。这说明当前很多模型上的加速，更多来自 `torch.compile` 的图级优化，比如算子融合、调度和内存规划，而不完全是某一个 Triton kernel 单独跑得特别快。

这其实引出了第一个关键瓶颈，就是 Triton 在端到端图里的覆盖率还不够高。以 CNN 为例，像 `resnet50`、`vgg16` 这类模型里，卷积相关计算的大头还是落在 cuBLAS/cuDNN 上，Triton 更多是在做 BatchNorm、ReLU、Add、Softmax、LayerNorm 这些融合后的 pointwise 或 reduction kernel。所以如果后面真想进一步把 CNN 或 Transformer 的上限继续往上推，Conv2D 和 MatMul 这一层的代码生成能力是绕不过去的。

第二个比较明确的瓶颈，是 matmul 相关 kernel 的寄存器压力。FlagGems 这一条线里，139 个成功算子总体平均 speedup 大概是 1.01 倍，绝大多数都落在 0.8 到 1.2 之间，说明单算子层面它和 PyTorch 原生 CUDA 大体是持平的，至少没有系统性变差。但在 NCU 里有一个点特别突出，就是 `mm_kernel_general` 的寄存器使用到了 254 个 register per thread，occupancy 只有 16.6%。这个数字和其他 kernel 一对比就很明显，因为其他大多数 kernel 的 occupancy 都在 70% 到 90% 之间。也就是说，Triton 在 pointwise、normalization、softmax 这一类 kernel 上其实已经比较健康了，真正比较扎眼的问题还是 matmul 的 tile 和寄存器分配。

第三个瓶颈是动态 shape 和量化路径。像 `nanogpt` 的回退，本质上不是单个 kernel 算得慢，而是动态 shape 带来的重编译和图级开销把收益吃掉了。量化模型的问题则更直接，目前 INT8 路径还不完整，所以一遇到量化 workload 就容易 fallback，最后整体反而比 eager 慢。这两类问题我觉得都不是“某个 kernel 调一调参数就能解决”的问题，而是需要编译链和后端能力一起补。

如果把这次工作的结论压缩成一句话，我会说：Triton 在“可融合、规则性强”的 workload 上已经表现出比较明确的潜力，但当前的主要短板集中在三类地方，分别是重计算核心算子的覆盖率、matmul 的寄存器/occupancy 问题，以及动态 shape 和量化场景下的编译链稳定性。

基于这个判断，我后面整理的优化方向也对应分了优先级。第一优先级是硬件自适应 autotuning 和更合理的 grid/tile 调度，因为这类优化能同时影响 GEMM 和 FlashAttention，也最可能直接改善目前看到的 occupancy 和大 shape 退化。第二优先级是把 matmul 的寄存器预算显式纳入编译或 autotune 过程，避免出现 `mm_kernel_general` 这种单点寄存器爆炸。第三优先级是动态 shape caching、INT8 支持和小算子 fast-path fallback，这一层更偏向把现有回退场景补齐。

最后总结一下，这次 benchmark 我觉得产出的核心价值不只是“跑出了几个 speedup 数字”，而是把 Triton 当前收益最大的场景、最明显的边界，以及最值得投入的优化方向都比较系统地理出来了。也就是说，现阶段我们已经不只是知道“它快不快”，而是开始知道“它为什么快”“为什么某些地方不快”，以及“下一步最该改哪里”。

我的汇报就到这里，谢谢大家。

---

## 汇报时建议重点强调的三句话

1. 这次工作不是只看端到端 speedup，而是把模型效果和 kernel 级瓶颈对齐起来看，所以结论更可解释。
2. Triton 当前最有价值的地方，是规则计算和融合友好的场景；最明显的短板，是重计算核心算子的覆盖率、matmul 寄存器压力，以及动态 shape/量化路径。
3. 这轮 benchmark 已经足够支持下一步优化排期，后续重点不是盲目补更多表格，而是围绕关键瓶颈做针对性验证。

---

## 追问口径

### 1. 如果老师问：为什么只做了 7 个模型的 NCU，不是 28 个全覆盖？

可以这样答：

“这一步我是按代表性采样来做的。因为 `ncu --set full` 的 profiling 成本比较高，如果对 28 个模型全量做，时间会非常长，而且很多模型类别其实信息重复。现阶段我的目标不是把 profile 数量堆满，而是先用覆盖 CNN、轻量级 CNN、NLP、大参数模型的样本，把共性瓶颈先抓出来。从结果看，这 7 个模型已经足够把 Conv2D 覆盖不足、cuBLAS 占主导、以及 Triton occupancy 偏低这些核心问题识别出来。后续如果要做专项优化，我会再补 targeted profiling，而不是平均用力。” 

### 2. 如果老师问：为什么有些模型 speedup 很高，但 Triton GPU 占比很低？

可以这样答：

“这个现象恰恰说明端到端加速不能简单等价成某一个 Triton kernel 变快了。当前很多收益其实来自 `torch.compile` 的图级优化，比如 fusion、调度和内存规划，而不是 Triton 已经覆盖了所有重计算 kernel。所以我的理解是，这次结果一方面验证了整个编译栈是有效的，另一方面也暴露出 Triton 在 Conv2D 和 GEMM 这类核心算子上的覆盖还可以继续加强。” 

### 3. 如果老师问：FlagGems 单算子平均只有 1.01x，是不是说明效果一般？

可以这样答：

“如果单看单算子 speedup，确实大多数结果是持平的。但我觉得这要结合 FlagGems 的定位来看。它更像是一个可替换、可融合的 Triton kernel 底座，而不是靠单个算子刷特别夸张的分数。单算子层面 92% 以上都落在中性区间，反而说明它作为 backend replacement 是比较稳的。真正的价值是在跟 `torch.compile` 结合以后，把多个 pointwise 或 normalization 链条融合掉，那个时候端到端收益会比单算子 benchmark 更有代表性。” 

### 4. 如果老师问：`nanogpt` 为什么掉到 0.10x，是不是说明方案不成熟？

可以这样答：

“我会把它理解成当前编译链边界被比较充分地暴露出来了。`nanogpt` 这类动态 shape workload 对编译缓存、shape specialization 和图稳定性要求很高，它的回退更多反映的是动态 shape 场景还需要专项优化，而不是所有 Triton 场景都不成熟。反过来说，这类负例很有价值，因为它明确告诉我们后续该优先补动态图缓存和重编译控制，而不是在已经表现不错的 CNN 场景上继续做重复优化。” 

### 5. 如果老师问：两套报告里的环境版本不完全一样，这会不会影响结论？

可以这样答：

“会影响绝对数值，但不影响我这次汇报里最核心的趋势判断。因为两套 benchmark 的目标本来就不一样，一套更偏端到端模型行为，另一套更偏 operator 和 profiling 级别验证，所以我是把它们当成互补证据来用，而不是强行横向比绝对 speedup。后面如果要做论文式结论或者更严格的横评，我会把环境进一步统一。” 

---

## 一句话收尾版

“这次 benchmark 的价值，不只是证明 Triton 在一部分 workload 上能加速，更重要的是把它当前真正有效的场景、暂时无效的场景，以及最值得优先投入的优化点，比较清楚地分层识别出来了。” 

---

## 3 分钟精简口播版

大家好，我这次主要做的是 Triton 相关 benchmark 的整理和分析，目标不是只看几个 speedup 数字，而是想回答三个问题：第一，Triton 在真实模型里到底有没有收益；第二，收益主要来自哪里；第三，目前最明显的瓶颈是什么。

这次我把分析分成了两条线。第一条线是端到端模型 benchmark，主要看 `torch.compile + Inductor + Triton` 放到真实模型里后的整体推理表现。第二条线是单算子和 profiling 分析，主要看 Triton 生成的 kernel 在硬件层面卡在哪里。这样做的好处是，既能看到最终效果，也能把问题定位到更细的层级。

从端到端结果看，收益最明显的是 CNN 和科学计算这类规则性比较强的 workload。比如两个 `pyhpc` 模型能到 15 倍到 34 倍，常见 CNN 像 `mobilenet_v3_large`、`shufflenet_v2`、`mobilenet_v2`、`resnet152` 基本在 5 到 8 倍之间。但也不是所有模型都变快，像 `nanogpt`、`Super_SloMo` 还有两个量化模型都出现了明显回退。这说明 Triton 当前的收益很依赖 workload 类型，规则计算和融合空间大的场景更容易获益，动态 shape、复杂控制流和量化场景则更容易暴露短板。

进一步看 profiling，有一个比较关键的现象：有些模型端到端 speedup 很高，但 Triton kernel 在 GPU 时间里的占比并不高。像 `mobilenet_v2` 和 `shufflenet_v2`，整体能到 6 到 7 倍，但 Triton GPU 占比只有 0.1% 到 0.3%。这说明当前很多收益其实更多来自 `torch.compile` 的图级优化，比如融合、调度和内存规划，而不完全是 Triton 已经覆盖了所有核心计算。

基于这些结果，我觉得目前最重要的瓶颈可以概括成三类。第一类是核心重计算算子的覆盖率还不够，尤其是 Conv2D 和 MatMul 这类大头，很多时间还是在 cuBLAS 或 cuDNN 上。第二类是 matmul kernel 的寄存器压力比较突出，比如 `mm_kernel_general` 在 NCU 里寄存器达到 254，occupancy 只有 16.6%，这个是比较明确的性能风险点。第三类是动态 shape 和量化路径还不稳定，像 `nanogpt` 的回退更多是重编译和图级开销问题，量化模型则是因为 INT8 路径还不完整。

所以如果看后续优化方向，我觉得优先级也比较清楚。第一优先级是硬件自适应 autotuning 和更合理的 tile/grid 调度，第二优先级是寄存器预算感知的 matmul 优化，第三优先级是动态 shape caching、INT8 支持和小算子 fast-path fallback。

最后总结一下，这次工作的核心价值不只是得到了 benchmark 结果，而是把 Triton 当前最适合的场景、最不适合的场景，以及最值得优先优化的瓶颈，比较系统地梳理出来了。谢谢大家。

---

## PPT 每页讲什么

### 第 1 页：题目页

这一页就一句话带过去：

“我这次汇报的主题是 Triton benchmark 的结果分析，重点想回答它在真实 workload 里有没有收益、收益来自哪里，以及当前主要瓶颈是什么。”

### 第 2 页：为什么要做这件事

这一页建议讲：

“我这次不是单纯想跑一个排行榜，而是想把 Triton 的端到端效果和 kernel 级瓶颈对应起来看。因为如果只看 speedup，能知道快不快；但只有把 profiling 也结合进来，才能知道为什么快、为什么某些地方不快。”

### 第 3 页：整体方法

这一页建议讲：

“我把分析分成了两条线。第一条是端到端模型 benchmark，主要看真实模型的推理延迟变化。第二条是单算子加 NCU profiling，主要看 Triton kernel 在硬件层面的行为。前者负责看结果，后者负责解释结果。”

### 第 4 页：端到端 benchmark 总览

这一页建议讲：

“这次模型 benchmark 总共覆盖了 104 个模型，其中成功跑通并拿到有效结果的是 28 个。虽然不是全覆盖，但已经覆盖了 CNN、轻量级 CNN、NLP、科学计算、量化模型和少量视频模型，所以足够支撑趋势判断。”

### 第 5 页：哪些模型提升明显

这一页建议讲：

“从结果看，提升最明显的是规则性强、融合空间大的 workload。像两个 `pyhpc` 模型收益最高，常见 CNN 里 `mobilenet_v3_large`、`shufflenet_v2`、`mobilenet_v2`、`resnet152` 也都比较明显，基本在 5 到 8 倍之间。说明 Triton 在这类场景里潜力比较明确。”

### 第 6 页：哪些模型回退明显

这一页建议讲：

“不是所有模型都会提升。像 `nanogpt`、`Super_SloMo` 和两个量化模型都出现了明显回退。这说明 Triton 当前不是通用无差别加速方案，它对 workload 结构比较敏感，动态 shape、复杂控制流和量化场景更容易暴露问题。”

### 第 7 页：NCU 为什么只选 7 个模型

这一页建议讲：

“模型级 NCU 我没有把 28 个全量都做，而是选了 7 个代表模型。原因是 `ncu --set full` 成本比较高，而且很多同类模型的信息重复。现阶段更重要的是用代表性样本先把共性瓶颈抓出来，而不是先把 profile 数量堆满。”

### 第 8 页：最关键的 profiling 现象

这一页建议讲：

“一个很关键的现象是，有些模型端到端 speedup 很高，但 Triton kernel 的 GPU 时间占比并不高。比如 `mobilenet_v2` 和 `shufflenet_v2`，整体收益很大，但 Triton 占比只有 0.1% 到 0.3%。这说明当前很多收益其实来自 `torch.compile` 的图级优化，而不只是 Triton 单个 kernel 的提升。”

### 第 9 页：瓶颈一，核心算子覆盖率不够

这一页建议讲：

“第一个瓶颈是核心重计算算子的覆盖率还不够。以 CNN 为例，Conv2D 的大头很多还在 cuBLAS 或 cuDNN 上，Triton 更多处理的是 BatchNorm、ReLU、Add、Softmax、LayerNorm 这种融合 kernel。所以如果要继续往上推性能，Conv2D 和 MatMul 这一层迟早要补。”

### 第 10 页：瓶颈二，MatMul 寄存器压力

这一页建议讲：

“第二个瓶颈是 matmul 的寄存器压力。在 FlagGems 的 profiling 里，`mm_kernel_general` 的寄存器达到 254，occupancy 只有 16.6%，而其他大部分 kernel 都在 70% 到 90% 之间。这个差距说明 matmul 的 tile 和寄存器分配是一个比较明确的优化点。”

### 第 11 页：瓶颈三，动态 shape 和量化

这一页建议讲：

“第三个瓶颈是动态 shape 和量化路径。`nanogpt` 的问题更多是动态图重编译和图级开销，量化模型则是因为 INT8 路径不完整。这类问题不是简单调 kernel 参数能解决的，更像是编译链能力边界。”

### 第 12 页：后续优化优先级

这一页建议讲：

“基于前面的结果，我觉得后续优化可以按三个优先级来排。第一优先级是硬件自适应 autotuning 和更合理的 tile/grid 调度；第二优先级是寄存器预算感知的 matmul 优化；第三优先级是动态 shape caching、INT8 支持和小算子 fast-path fallback。”

### 第 13 页：总结页

这一页建议讲：

“最后总结一下，这次 benchmark 的价值不只是证明 Triton 在某些场景下能加速，更重要的是把它当前真正有效的场景、暂时无效的场景，以及最值得优先投入的优化点，比较系统地识别出来了。也就是说，我们现在不只是知道它快不快，而是开始知道它为什么快、为什么不快，以及下一步最该改哪里。”

---

## 按你的 Markdown 讲得更完整的一版

这一版更适合你希望“把报告里的东西尽量讲全”，而不是只讲一个高层摘要。

大家好，我这次汇报的主题是 Triton 在不同 benchmark 视角下的性能表现、当前暴露出来的编译器瓶颈，以及我整理出的后续优化思路。

这次工作我主要参考了四部分材料。第一部分是端到端模型 benchmark，也就是 torchbenchmark 这条线，关注的是 `torch.compile + Inductor + Triton` 放到真实模型里以后，整体推理延迟有没有改善。第二部分是 FlagGems 单算子 benchmark，关注的是把 PyTorch 的算子替换成 Triton kernel 之后，单个算子的性能和稳定性怎么样。第三部分是 NCU profiling，用硬件计数器去看 GPU 时间分布、occupancy、寄存器和 memory throughput。第四部分是 GEMM 和 FlashAttention 这类专项分析，用来补足模型 benchmark 之外的算子级细节。

如果先看端到端模型 benchmark，这次 torchbenchmark 一共涉及 104 个模型，其中成功跑通并拿到有效数据的是 28 个，另外有一部分是依赖缺失、load failed、OOM、timeout，剩下还有一些是提前预跳过的模型。从类别上看，28 个成功模型已经覆盖了标准 CNN、轻量级 CNN、NLP/Transformer、科学计算、量化模型、GAN 和部分视频模型，所以虽然不是全量覆盖，但已经足够支撑趋势分析。

从结果分布看，端到端收益大致分成几档。第一档是大幅加速，主要是规则性很强的科学计算模型，比如 `pyhpc_isoneutral_mixing` 能到 34 倍，`pyhpc_equation_of_state` 大概 15 倍。第二档是 CNN 的明显加速，像 `mobilenet_v3_large`、`shufflenet_v2_x1_0`、`mobilenet_v2`、`resnet152`、`densenet121` 这些基本都在 5 到 8 倍之间。第三档是小幅加速，比如 BERT、cm3leon、部分 functorch 相关模型，大概在 1 到 2 倍之间。第四档是基本持平，比如 `vgg16`、`alexnet` 这一类。最后一档是回退，最典型的是 `nanogpt`、`Super_SloMo`，以及两个量化模型。

这个结果说明，Triton 相关编译栈当前不是“普适无差别加速”，它更适合规则性强、融合空间大、图比较稳定的 workload；而动态 shape、多控制流、量化路径不完整的场景，更容易暴露短板。这一点我觉得是这次 benchmark 的第一个核心结论，因为它把 Triton 当前的适用边界比较清楚地画出来了。

在模型级 profiling 这部分，我重点对 7 个代表模型做了 NCU，而不是把 28 个全量都 profile 一遍。这 7 个模型包括 `resnet50`、`resnet18`、`BERT_pytorch`、`vgg16`、`densenet121`、`mobilenet_v2`、`shufflenet_v2_x1_0`。选这几个模型的目的是覆盖标准 CNN、浅层 CNN、大参数 CNN、高效 CNN 和 NLP 这几种典型类型。原因也比较实际，因为 `ncu --set full` 的 profiling 成本比较高，单个模型通常就要几分钟，复杂模型会更久，所以这一轮更强调代表性采样和共性瓶颈识别。

从这 7 个模型里，最值得讲的现象是：很多模型端到端加速很高，但 Triton kernel 的 GPU 时间占比并不高。比如 `mobilenet_v2` 和 `shufflenet_v2_x1_0` 的端到端 speedup 都在 6 到 7 倍，但 Triton GPU 时间占比只有 0.1% 到 0.3%，大部分时间并不在 Triton kernel 上。像 `resnet50` 这种 Triton 覆盖相对更高的模型，Triton GPU 时间占比也只有 17.4%，而 `BERT_pytorch` 大概是 9.4%。反过来，cuBLAS、cuDNN 或其他底层库调用仍然占了模型中的大头。

这个现象其实很关键，因为它说明当前很多端到端收益并不完全来自 Triton 单个 kernel 自己跑得很快，而是更多来自 `torch.compile` 带来的图级优化，比如算子融合、调度优化、内存规划，以及减少中间张量写回。也就是说，Triton 当前在整个编译栈里的价值，除了直接生成 kernel 之外，还有一部分是作为融合后 kernel 的承载后端。

如果继续往下拆模型级瓶颈，第一类问题是核心计算算子的覆盖率还不够。以 CNN 为例，卷积相关的大头很多还是落在 cuBLAS/cuDNN 或者底层高性能库上，Triton 更多是在处理 BatchNorm、ReLU、Add、LayerNorm、Softmax 这类融合后的 pointwise 或 reduction kernel。对于 BERT 这类模型也是类似，GELU、LayerNorm、Softmax+Mask 这些融合 kernel 能看到 Triton 的存在，但 GEMM 主体仍然主要依赖库实现。所以如果未来想让 Triton 在端到端图里的存在感更强，Conv2D 和 MatMul 这两个核心重计算算子迟早要重点补。

第二类模型级问题是动态 shape 和量化路径。`nanogpt` 的回退非常明显，速度只有 eager 的 0.10 倍，这类问题更像是动态图和重编译开销的问题，而不是某一个 kernel 算得慢。`Super_SloMo` 这种复杂控制流和视频相关 workload 也有类似情况。量化模型则更直接，目前 INT8 路径不完整，所以一旦进入量化算子链路，很容易 fallback，最后整体速度反而不如 eager。

再看 FlagGems 这条单算子 benchmark。这里总共涉及 433 个注册算子，其中 146 个能够被成功映射并测试，最终 139 个成功完成 benchmark，成功率大概是 95.2%。这组数据的意义不在于单个算子分数有多夸张，而在于它能回答两个问题：第一，作为替换 PyTorch dispatch 的 Triton 后端，它稳不稳定；第二，单算子层面到底是整体变快了，还是至少没有系统性变差。

从结果上看，139 个算子的平均加速比大概是 1.01 倍，中位数接近 1，92% 以上都落在 0.8 到 1.2 之间。这说明 FlagGems 作为一个 Triton kernel 替换底座，整体是比较稳的。它不是靠大量单算子刷出 2 倍、3 倍的结果，而是先做到和 PyTorch 原生 CUDA 基本持平，然后把真正的收益留给上层的融合。

分类来看，normalization 这一类算子收益最稳定，像 `layer_norm`、`group_norm`、`batch_norm` 平均大概在 1.15 到 1.19 倍之间；manipulation 和 creation 里也有一些算子表现不错，比如 `full`、`index_add`、`isin`、`zeros`。但也有明显回退的算子，最典型的是 `arange`，只有 0.40 倍，另外像 `gt`、`le`、`logical_or` 这类比较和逻辑运算也有不同程度回退。这里的解释也比较清楚：`arange` 这种极小延迟算子，本身计算量很小，kernel launch overhead 很容易压过真正计算；而比较/逻辑运算的 bool kernel 目前没有做到和 PyTorch CUDA 内核一样高效，所以单算子上容易输。

NCU 对 FlagGems 的 profiling 也给了一个很清楚的图景。大多数 pointwise、copy、activation、softmax 相关 kernel 的 occupancy 都比较健康，很多在 70% 到 90% 之间，说明这些 kernel 在硬件层面并不差。真正最明显的异常点是 `mm_kernel_general`，它的寄存器使用达到了 254 registers per thread，occupancy 只有 16.6%。这个点非常重要，因为它说明 matmul 相关 kernel 当前最大的风险不是“完全跑不动”，而是 tile 设计和寄存器预算失衡，导致并行度被压得很低。

如果把这次 benchmark 暴露出来的问题压缩成一个瓶颈矩阵，我会分成几类。第一，Conv2D 代码生成能力缺失或者覆盖不足，导致 CNN 大头依然在 cuBLAS/cuDNN。第二，MatMul 的寄存器压力过高，尤其是 `mm_kernel_general` 是非常突出的例子。第三，INT8 量化路径缺失，所以量化模型全面回退。第四，动态 shape 场景下重编译和图缓存能力不够，像 `nanogpt` 这种场景受影响特别大。第五，部分 fp32 GEMM 没有充分吃到 TensorCore 路径，像 BERT 这类模型的提升还有限。第六，小算子的 launch overhead 和 bool/comparison kernel 的退化，也说明 dispatch 和 kernel specialization 还有继续打磨空间。

下面我单独讲一下 Triton 的优化思路，因为这部分是你汇报里一定要突出出来的。

我觉得第一优先级的优化方向，是硬件自适应 autotuning。现在很多 autotune config 更像是“通用搜索”，但不同 GPU 的 SM 数量、shared memory、L2 cache 容量都不一样。像 RTX 3080 和 A100/H100 的硬件条件差别很大，如果 persistent matmul 或 grouped GEMM 的配置主要是按数据中心卡思路设计，那么在消费级 GPU 上就很容易出现性能退化或者 shared memory 超限。所以一个很自然的方向，就是在 autotuning 之前先做 config 过滤，让 tile 大小、num_warps、num_stages、shared memory 占用、理论 occupancy 都和目标硬件匹配。这个方向的好处是影响面很大，GEMM、grouped GEMM、甚至 FlashAttention 的部分 tile 选择都能受益。

第二优先级的方向，是更合理的 grid 和 tile 调度，尤其是针对大 M、小 N 或者长序列这类极端形状。报告里 GEMM 的专项分析已经说明，persistent matmul 在某些大 M 形状上会严重退化，本质上就是 block 划分和负载均衡出了问题。这里可以考虑多维 grid launch、Stream-K、work-stealing、或者更灵活的 tile traversal 策略，而不是只用比较固定的一维 launch 方式。对 FlashAttention 来说，长序列场景下也有类似问题，seq_len 到了 8192 以后加速明显下降，很可能和 tile 重复加载、L2 驻留不住、迭代次数太多有关，所以也需要做序列长度感知的 tile 选择。

第三个方向，是寄存器预算感知的编译或 autotune 过程。`mm_kernel_general` 的 254 registers per thread 已经是一个很强的信号，说明现在的 tile 配置虽然未必在功能上有问题，但在 RTX 3080 这类卡上会把 occupancy 压得很低。这里可以考虑做一个类似 `RegisterBudgetAnalysis` 的 pass，或者至少在 autotune 阶段加入 register budget pruning，把明显超预算的配置提前裁掉。这样做的核心目标不是一味追求更大的 tile，而是让 tile 大小、寄存器占用、occupancy 之间达到一个更合理的平衡。

第四个方向，是补动态 shape caching 和图稳定性优化。像 `nanogpt` 这类问题，并不是 pointwise kernel 不行，而是 shape 变化导致反复重编译、图不稳定、编译开销反复进入推理路径。所以如果后面要面向 GPT 类 workload 做优化，shape bucketing、shape-generic caching、磁盘缓存复用，以及减少 layout conversion 的跨图传播开销，都会是非常关键的方向。这个部分更偏编译链整体问题，不是单个 kernel 能解决的，但对真实大模型工作负载会非常重要。

第五个方向，是补齐核心缺失路径，尤其是 Conv2D 和 INT8。Conv2D 的意义在于它决定了 Triton 能不能从“主要加速融合和 pointwise”进一步走向“覆盖模型中的重计算主体”。INT8 的意义则更直接，因为只要量化路径不完整，量化模型就会天然回退，这会限制 Triton 在部署场景中的实际价值。所以这两项虽然开发成本高，但从战略意义上讲是不能一直回避的。

第六个方向，我觉得还要单独强调 matmul 对 Tensor Core 的利用问题。因为从 benchmark 和 profiling 来看，很多 matmul 场景并没有充分走到 Tensor Core 路径，而是更多落在普通 FMA 单元上。这个问题很关键，因为 FMA 路径虽然能保证正确性和通用性，但它的吞吐上限明显低于 Tensor Core，尤其是在 Ampere 这代卡上，fp16/bf16 matmul 如果没有很好映射到 Tensor Core，理论算力就吃不满。像 BERT 这类模型里，GEMM 仍然是主要耗时部分，如果 matmul 还停留在 FMA 主导的执行方式，那 Triton 在重计算核心上的上限就会被提前锁死。所以一个很重要的优化思路，就是继续强化 `AccelerateMatmul`、`OptimizeDotOperands` 和相关 lowering，让更多满足条件的 matmul 稳定落到 Tensor Core 指令上，而不是退回到常规 FMA 实现。这里可以进一步做三件事：第一，增强 pattern 识别，确保 fp16、bf16 甚至部分 fp32 dot 都能进入 Tensor Core-friendly 的 layout 和 instruction path；第二，在 autotuning 或 lowering 阶段显式约束 tile、warp 和 operand layout，避免因为布局不合适导致 Tensor Core 无法触发；第三，把 Tensor Core 使用情况纳入 profiling 和调优目标，不只是看最终 latency，还要看是否真正命中了 MMA/Tensor Core 路径。这个方向的价值非常高，因为它不是在修边角，而是在抬高 Triton 处理 matmul 这类核心算子的理论上限。

第七个方向，是小算子和比较/逻辑运算的专门优化。像 `arange`、`linspace` 这类极小算子，更适合做 fast-path fallback，也就是当 eager 已经非常快时，直接不要走 Triton kernel，避免 launch overhead 吃掉收益。像 `gt`、`le`、`logical_or` 这种 bool kernel，则更适合做专门的 vectorized store、bit-packing 或者更贴近 PyTorch CUDA kernel 的 specialization。虽然这类优化不会像 Conv2D、MatMul 或 Tensor Core 路径一样决定大盘，但它们能提高整个后端的完整度和稳定性。

如果再和专项分析结果结合一下，GEMM 和 FlashAttention 这两类算子其实也给出了比较明确的信号。GEMM 这边最稳的是 tutorial matmul，persistent matmul 在部分大 M 形状上反而明显退化，说明“更高级的调度形式”不等于“在所有硬件和 shape 上都更优”。FlashAttention 这边中等长度序列收益最明显，但到长序列以后加速缩小，说明 tile 策略和 cache 行为开始成为主要因素。这两个专项结论都支持前面说的两件事：一是要做更强的硬件自适应 autotuning，二是要做更细的 shape-aware 调度。

最后如果总结这次工作，我会把结论分成三层。第一层是结果层，Triton 相关编译栈在 CNN、科学计算、normalization 和部分融合友好场景上已经能带来明确收益，但在动态 shape、量化、复杂控制流场景下仍然存在明显边界。第二层是机理层，目前很多端到端加速来自图级优化和融合，而不是 Triton 已经主导了所有核心计算。第三层是优化层，后续最值得投入的方向已经比较清楚，就是硬件自适应 autotuning、grid/tile 调度、寄存器预算控制、动态 shape caching，以及 Conv2D 和 INT8 这两条关键能力补齐。

我的理解是，这次 benchmark 的价值不只是得出“快”或者“慢”的结论，而是把 Triton 当前真正有效的地方、暂时还不够好的地方、以及下一步最值得投入的优化路径，比较系统地拆开了。这样后面无论是做进一步实验、优化实现，还是继续扩展 benchmark，都有了更清晰的抓手。

---

## Triton 优化思路单独页

如果你 PPT 里想单独放一页“优化思路”，这一页建议直接讲下面这段：

“基于这次 benchmark，我认为 Triton 后续优化可以分成七个方向。第一，做硬件自适应 autotuning，把 SM 数量、shared memory、L2 cache 和理论 occupancy 纳入 config 选择，而不是沿用通用配置。第二，优化 grid 和 tile 调度，尤其是大 M、小 N、长序列这类极端 shape，考虑多维 grid、Stream-K、work-stealing 和 shape-aware tile traversal。第三，做寄存器预算感知优化，避免像 `mm_kernel_general` 这样寄存器达到 254、occupancy 只有 16.6% 的情况。第四，单独强化 matmul 到 Tensor Core 的映射能力，减少落在普通 FMA 单元上的情况，让 fp16、bf16 以及可支持的 fp32 dot 更稳定命中 MMA/Tensor Core 路径。第五，补动态 shape caching 和图稳定性优化，减少 GPT 类 workload 的重编译开销。第六，补齐 Conv2D 和 INT8 这两条关键能力路径，让 Triton 不只擅长 pointwise 和融合，还能更深入覆盖模型主计算。第七，给极小算子和 bool/comparison kernel 做 fast-path fallback 或专门 specialization，提升后端完整度和稳定性。” 

---

## 如果老师追问“你的 Triton 优化思路从哪来”

可以这样答：

“我这部分不是拍脑袋列方向，而是从 benchmark 现象反推出来的。比如 `mm_kernel_general` 的 254 registers 和 16.6% occupancy，会直接指向寄存器预算和 tile 设计问题；长序列 FlashAttention 的退化，会指向 shape-aware tile 调度和 cache 行为；`nanogpt` 的 0.10x 回退，会直接指向动态 shape caching 和重编译控制；量化模型全面回退，则直接说明 INT8 路径需要补齐。所以这些优化方向都是和观测到的瓶颈一一对应的。” 

---

## MatMul 为什么要重点强调 Tensor Core 而不是 FMA

这一段你在汇报里可以单独讲：

“我觉得 matmul 这一块要特别强调一个点，就是很多性能上限其实取决于它到底有没有真正走到 Tensor Core，而不是只靠普通 FMA 单元在算。因为对 Ampere 这类 GPU 来说，Tensor Core 是处理 fp16、bf16 甚至部分 tf32/fp32 dot 的核心吞吐来源；如果 matmul 没有命中 Tensor Core，而是退回到普通 FMA 路径，那么即使 kernel 本身功能正确，理论算力上限也会明显偏低。这个问题和一般的 pointwise 优化不一样，它不是把一个已经不错的 kernel 再磨一点，而是决定 matmul 这类核心算子能不能进入高吞吐执行通道。所以我认为后续 Triton 优化里，除了看 latency 和 occupancy，还要把‘是否真正命中 Tensor Core 路径’当成一个核心目标去优化。” 

### 这部分可以继续展开成三点

1. `pattern` 和 `layout` 要更稳定地触发 Tensor Core。
   也就是让 `AccelerateMatmul`、`OptimizeDotOperands`、`F32DotTC` 这类 pass 更稳定地把可支持的 dot/matmul 映射到 MMA/Tensor Core 指令，而不是因为 operand layout、tile 配置或者数据类型条件不满足，最后退回 FMA。

2. autotuning 目标不能只看“能跑通”，还要看“有没有把 Tensor Core 吃满”。
   也就是说，后续调优不应该只比较 latency，还应该结合 profiling 去看实际执行路径、Tensor Core 命中情况、寄存器压力和 occupancy，避免选出一个“表面能跑、实际上没吃到 Tensor Core”的次优配置。

3. 这条优化线对 BERT、GPT、MLP 这类模型意义尤其大。
   因为这几类模型的大头基本都在 matmul 上，如果 matmul 还没有稳定用上 Tensor Core，那么上层 fusion 做得再好，整体提升也会很快碰到天花板。

### 如果老师追问“为什么你觉得这是重点”

可以这样答：

“因为我这次 benchmark 里最明显的瓶颈之一就是重计算核心算子没有被 Triton 充分接住，而 matmul 又是 Transformer 和很多 MLP 类 workload 的绝对主体。如果它没有稳定走到 Tensor Core，而是落在普通 FMA 单元，那就相当于最核心的算力通道没有完全打开。所以我会把这个方向看成不是局部微调，而是决定 Triton 能不能真正进入高性能 matmul 核心路径的关键问题。” 
