---
title: "Pointers and Linked Lists: Addresses, and the Data Structure Made of Them"
seoTitle: "Pointers and Linked Lists in C and C++"
description: "A pointer is the address of a box, not the box. Once that clicks, dynamic memory, references and the linked list all fall out of the same idea. In C and C++."
date: 2016-12-18
permalink: "/posts/2016/12/pointers-and-linked-lists/"
lang: en
tags:
  - "algorithms"
  - "pointers"
  - "linked lists"
  - "c++"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 5
math: true
---

*A pointer frightens people because it is taught as syntax. It is not syntax, it is one idea: a variable holds a value, and a pointer holds the address where a value lives. Every confusing thing about pointers, and the whole of the linked list, comes straight out of that one sentence. This part is in C and C++, because pointers are what those languages make you hold in your hand.*

## 1. A variable is a box; a pointer holds a box's address

When you write `int x = 42`, the machine sets aside a small box in memory, labels it `x`, and puts 42 in it. That box has an address, a number saying where in memory it sits. A pointer is a variable whose value is that address.

```c
int x = 42;
int *p = &x;     // p holds the address of x
```

Two operators, and they are opposites:

- `&x` is **address of**: give me the address of the box `x`.
- `*p` is **dereference**: give me the value in the box that `p` points at.

```c
#include <stdio.h>

int main(void) {
    int x = 42;
    int *p = &x;         // p points at x
    printf("%d\n", *p);  // 42: the value p points at
    *p = 100;            // change the box p points at
    printf("%d\n", x);   // 100: we changed x through p
    return 0;
}
```

The last two lines are the whole point of pointers. `*p = 100` did not change `p`; it changed the box `p` points at, which is `x`. A pointer lets you reach a variable that is not in front of you.

```
   memory

   address   value    name
   0x7ffc    100      x  <----+
   ...                        |
   0x7fe0    0x7ffc   p  -----+   p holds the address of x
```

## 2. Why the language forces this on you: passing by value

Here is the problem pointers solve. This function does nothing useful:

```c
void increment(int n) {
    n = n + 1;      // changes a copy, thrown away when the function returns
}
```

C passes arguments **by value**: `increment` receives a copy of the number, changes the copy, and the copy vanishes. The caller's variable is untouched. To change the caller's variable, you have to hand over its address, not its value:

```c
void increment(int *n) {
    *n = *n + 1;    // change the box the caller gave us the address of
}

// called as: increment(&count);
```

The classic example is swapping two variables, which is impossible without pointers in C:

```c
void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}
// swap(&x, &y);  now x and y are actually exchanged
```

Every "output parameter" in C, every function that fills in a result rather than returning it, works this way. It is also how a function returns more than one value.

## 3. Arrays are pointers wearing a costume

In C, an array's name is, in almost every expression, the address of its first element. That is why `a[i]` and `*(a + i)` are the same thing, and it is why an array passed to a function arrives as a pointer.

```c
#include <stdio.h>

long long sum(const int *a, int n) {   // an array arrives as a pointer
    long long total = 0;
    for (int i = 0; i < n; i++)
        total += a[i];                 // a[i] means *(a + i)
    return total;
}

int main(void) {
    int nums[] = {3, 1, 4, 1, 5};
    printf("%lld\n", sum(nums, 5));    // nums decays to &nums[0]
    return 0;
}
```

`a + 1` does not add 1 to the address. It adds `sizeof(int)` bytes, moving to the next element. Pointer arithmetic counts in elements, not bytes, which is exactly what you want. This is also the reason a function receiving an array must also receive its length: the pointer has forgotten how long the array was.

That "forgotten length" is the source of the most famous class of bug in C, and the subject of a later series on security: read or write past the end of an array and nothing stops you, because a pointer is just a number and `a[1000000]` is a perfectly valid number.

## 4. C++ references: a pointer with the sharp edges filed off

C++ keeps pointers but adds **references**, which are the common, safe case made easy. A reference is another name for an existing variable. Under the surface it is a pointer, but you never see the `*` or `&` at the point of use, it can never be null, and it can never be pointed at something else after it is set.

```cpp
void increment(int &n) {   // n is a reference to the caller's variable
    n = n + 1;             // no dereference needed
}
// called as: increment(count);  note: no &

void swap(int &a, int &b) {
    int tmp = a;
    a = b;
    b = tmp;
}
```

The rule of thumb I still use: **a reference when the thing must exist, a pointer when it might be absent.** A function that must be given a customer takes a reference; a function that walks to the end of a list and returns "the next node, or nothing" returns a pointer, because nothing is a real answer and a pointer can be null to say so.

And to avoid copying a large object, pass it by `const` reference. This looks like pass by value and costs like pass by pointer:

```cpp
long long sum(const std::vector<int> &v) {   // no copy of the vector
    long long total = 0;
    for (int x : v) total += x;
    return total;
}
```

Without the `&`, calling `sum` on a million-element vector would copy all million elements first. That single missing character is a real performance bug, and I will come back to why in [part 21](/posts/2021/11/memory-and-why-arrays-win/).

## 5. The stack and the heap

So far every variable has lived on the **stack**: created when a function is entered, destroyed when it returns, and you do not manage it. That is why returning a pointer to a local variable is a trap:

```cpp no-compile
int *broken() {
    int x = 42;
    return &x;      // x dies when broken() returns; the pointer dangles
}
```

When you need memory that outlives the function that made it, or whose size you do not know until the program runs, you ask for it from the **heap**. In C, that is `malloc` and `free`; in C++, `new` and `delete`.

```cpp
void run(int n) {
    int *a = new int[n];    // n known only at run time; yours until you free it
    // ... use a[0..n-1] ...
    delete[] a;             // hand it back
}
```

Every `new` needs its `delete`, and every `malloc` its `free`. Forget, and the memory is leaked: still reserved, no longer reachable. Free twice, or use after freeing, and you get the undefined behaviour that eats afternoons. Modern C++ hands this off to `std::vector` and smart pointers so you almost never write a raw `new`, and that is the right default. But you have to know what they are doing underneath, which is this.

## 6. The linked list

Now the data structure built entirely from pointers. An array is one contiguous block. A **linked list** is the opposite: each element is its own little block, holding a value and a pointer to the next block.

```cpp
struct Node {
    int value;
    Node *next;     // points at the next node, or nullptr at the end
};
```

```
  head
   |
   v
  [ 3 | *]---> [ 1 | *]---> [ 4 | *]---> nullptr
```

The nodes can be anywhere in memory. What holds the list together is the chain of `next` pointers. You keep one pointer, `head`, to the first node, and follow `next` until you hit `nullptr`.

```cpp
long long sum(Node *head) {
    long long total = 0;
    for (Node *cur = head; cur != nullptr; cur = cur->next)
        total += cur->value;      // cur->value means (*cur).value
    return total;
}
```

`cur->value` is shorthand for `(*cur).value`: dereference the pointer, then take the field. You will type `->` constantly.

### What it is good at, and what it is not

The trade against an array is sharp and worth memorising.

| Operation | Array | Linked list |
|---|---|---|
| Read the `i`-th element | $\mathcal{O}(1)$ | $\mathcal{O}(n)$, you must walk |
| Insert or delete at a known node | $\mathcal{O}(n)$, shift the rest | $\mathcal{O}(1)$, relink |
| Insert or delete at the front | $\mathcal{O}(n)$ | $\mathcal{O}(1)$ |
| Memory per element | just the value | the value plus a pointer |
| Cache behaviour | excellent, contiguous | poor, scattered |

A linked list buys $\mathcal{O}(1)$ insertion and deletion at a point you already hold, and pays for it with $\mathcal{O}(n)$ access to the `i`-th element and, in practice, much slower traversal because the nodes are scattered across memory. [Part 21](/posts/2021/11/memory-and-why-arrays-win/) is about that last row, and it is the reason the honest advice is: **in competitive programming, and most of the time elsewhere, use an array.** The linked list is worth understanding deeply and reaching for rarely.

### Inserting and deleting, which is the only reason to use one

Inserting after a node you hold is three assignments and no shifting:

```cpp
void insert_after(Node *node, int value) {
    Node *fresh = new Node{value, node->next};
    node->next = fresh;
}
```

```
  before:  [ node |*]--------> [ next |*]--->

  after:   [ node |*]--> [ new |*]--> [ next |*]--->
```

Deleting the node after one you hold is the mirror image. The one care is to keep the pointer to the doomed node so you can free it:

```cpp
void delete_after(Node *node) {
    Node *doomed = node->next;
    if (doomed == nullptr) return;
    node->next = doomed->next;   // splice it out of the chain first
    delete doomed;               // then free it
}
```

Splice first, free second. Free it first and `doomed->next` reads freed memory. That ordering is the whole skill of pointer-based structures: change the links, then release what you unlinked.

### Doubly linked, and the standard library

A **doubly linked list** adds a `prev` pointer to each node, so you can walk backwards and delete a node knowing only that node, without its predecessor. It costs a second pointer per element. This is what `std::list` is.

You will almost never write any of this by hand, because the standard library has it:

```cpp
#include <list>
#include <forward_list>

std::list<int> dl;              // doubly linked
dl.push_back(3);
dl.push_front(1);               // O(1) at both ends

std::forward_list<int> sl;      // singly linked, smaller
sl.push_front(4);
```

And `std::vector` is the array you should reach for first: contiguous, cache-friendly, $\mathcal{O}(1)$ indexing, and amortised $\mathcal{O}(1)$ append. Know the linked list so you understand what `std::list` costs; use `std::vector` unless you have measured a reason not to.

## 7. The pointer bugs, named

Every one of these has cost me hours, and naming them is half the cure.

**Null dereference.** `*p` when `p` is `nullptr`. A crash if you are lucky, silent corruption if you are not. Check before you dereference anything that might be null.

**Dangling pointer.** A pointer to memory that has been freed or has gone out of scope, like the `broken()` function above. Reading it is undefined.

**Memory leak.** A `new` with no matching `delete`. The program's memory grows until it dies. Harmless in a five-line contest solution, fatal in a service that runs for a month.

**Double free.** Calling `delete` twice on the same pointer. Set a pointer to `nullptr` after freeing, because `delete nullptr` is safe and does nothing.

**Off-by-one past the array end.** `a[n]` on an array of length `n`. The valid indices are `0` to `n - 1`. Nothing stops you, and this one class of mistake is the foundation of an entire field of security exploits.

The modern C++ answer to most of these is: do not manage memory by hand. Use `std::vector`, `std::string`, and smart pointers (`std::unique_ptr`, `std::shared_ptr`), and the compiler and the library keep the accounting for you. But the accounting is still happening, and when it goes wrong you debug it in the terms of this post.

## The short version

- A pointer holds an address, not a value. `&x` is the address of `x`; `*p` is the value at the address in `p`. Changing `*p` changes the box `p` points at.
- C passes by value, so to let a function change your variable, or return more than one thing, you pass an address. That is what `swap(&x, &y)` is doing.
- An array's name is the address of its first element, so `a[i]` is `*(a + i)`, and a function receiving an array must also receive its length.
- A C++ reference is a pointer with the sharp edges removed: it cannot be null or rebound. Use a reference when the thing must exist, a pointer when it might be absent, and a `const` reference to pass big objects without copying.
- Stack memory is managed for you and dies with the function. Heap memory (`new`/`delete`, `malloc`/`free`) outlives it and is yours to release. Every allocation needs exactly one free.
- A linked list is nodes joined by `next` pointers. It buys $\mathcal{O}(1)$ insert and delete at a node you hold, and pays with $\mathcal{O}(n)$ indexing and poor cache behaviour. Understand it; reach for `std::vector` anyway.
- When you edit a list, change the links first and free the unlinked node second.
- The pointer bugs have names: null dereference, dangling pointer, leak, double free, and the off-by-one past the array end. The last one is where the security series will begin.

Next: binary search, and the version of it that is far more useful than searching a sorted array.
